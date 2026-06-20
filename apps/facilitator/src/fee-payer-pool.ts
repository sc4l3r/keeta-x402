import { Log as Logger } from "@keetanetwork/anchor/lib/log/index.js";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import type { FacilitatorKeetaSigner } from "@x402/keeta";
import type { NetworkIDs } from "./config.js";
import { requestFaucet } from "./faucet.js";
import type { TokenInfo } from "./token.js";

/**
 * A function that refills a fee-payer account's base-token balance.
 *
 * Called automatically when a fee payer's balance drops below `refillThreshold`
 * (i.e. becomes degraded or unhealthy).
 *
 * @param address - The fee-payer account address to refill.
 * @param network - The network the fee payer operates on.
 * @param amount  - The raw base-token units needed to reach the refill target.
 */
export type Refiller = (
  address: string,
  network: NetworkIDs,
  amount: bigint,
) => Promise<void>;

/**
 * Health of a fee-payer account, derived from its base-token balance:
 *
 * - `healthy`   - at or above `refillThreshold`; nothing to do.
 * - `degraded`  - between `minBalance` and `refillThreshold`; still eligible for
 *                 selection, but proactively refilled so it (ideally) never reaches the floor.
 * - `unhealthy` - below `minBalance`; excluded from selection until refilled.
 */
type FeePayerHealth = "healthy" | "degraded" | "unhealthy";

type FeePayerState = {
  /** Current balance-derived health classification. */
  health: FeePayerHealth;
  /** True while a faucet/refiller request is in flight for this account. */
  refilling: boolean;
};

type FeePayerPoolOptions = {
  /**
   * Minimum base-token balance (in raw units) below which an account is
   * considered unhealthy and excluded from fee-payer selection.
   */
  minBalance: bigint;
  /**
   * Base-token balance (in raw units) below which an account is considered
   * "degraded" and proactively refilled while still remaining eligible for
   * selection. Must be >= `minBalance` and <= `refillTarget`.
   */
  refillThreshold: bigint;
  /**
   * Base-token balance (in raw units) an account must reach after a refill
   * before it is re-admitted as healthy to avoid flapping at the
   * threshold.
   */
  refillTarget: bigint;
  /** How often (ms) to poll all accounts' balances. */
  pollIntervalMs: number;
  /** Optional hook called to top up an account. */
  refiller?: Refiller;
  /** Logger instance. */
  logger?: InstanceType<typeof Logger>;
};

export function faucetRefiller(
  logger: InstanceType<typeof Logger>,
  baseTokenInfo: TokenInfo,
): Refiller {
  return async (address: string, _net: NetworkIDs, amount: bigint) => {
    // Convert raw units to whole KTA, rounding up.
    const ktaNeeded = Math.ceil(Number(amount) / 10 ** baseTokenInfo.decimals);
    // Faucet caps at 10 KTA per request; batch if needed.
    const requestCount = Math.ceil(ktaNeeded / 10);
    logger.info(
      "facilitator",
      `Requesting ${ktaNeeded} KTA (${requestCount} faucet request(s)) for ${address}`,
    );
    for (let i = 0; i < requestCount; i++) {
      await requestFaucet(address, String(Math.min(10, ktaNeeded - i * 10)));
    }
  };
}

/**
 * Manages a pool of fee-payer accounts, tracking balance health and
 * automatically refilling accounts on testnet when their balance runs low.
 */
export class FeePayerPool {
  private readonly signer: FacilitatorKeetaSigner;
  private readonly network: NetworkIDs;
  private readonly options: Required<
    Omit<FeePayerPoolOptions, "refiller" | "logger">
  > & {
    refiller?: Refiller;
  };
  private readonly state: Map<string, FeePayerState>;
  private readonly logger: InstanceType<typeof Logger> | undefined;

  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private polling = false;

  /**
   * Creates a new FeePayerPool.
   *
   * All addresses reported by `signer.getAddresses()` are seeded optimistically
   * as healthy so the facilitator can start accepting payments immediately
   * without waiting for the first poll.
   *
   * @param signer  - Facilitator signer whose addresses form the pool.
   * @param network - Network descriptor (used to build clients and by the refiller).
   * @param options - Configuration: balance thresholds, poll interval, optional refiller.
   */
  constructor(
    signer: FacilitatorKeetaSigner,
    network: NetworkIDs,
    options: FeePayerPoolOptions,
  ) {
    this.signer = signer;
    this.network = network;
    this.logger = options.logger;
    this.options = {
      minBalance: options.minBalance,
      refillThreshold: options.refillThreshold,
      refillTarget: options.refillTarget,
      pollIntervalMs: options.pollIntervalMs,
      refiller: options.refiller,
    };

    // Seed all accounts optimistically as healthy.
    this.state = new Map(
      signer
        .getAddresses()
        .map((addr) => [addr, { health: "healthy", refilling: false }]),
    );
  }

  /**
   * Run an initial blocking balance sweep, then start the background poll loop.
   *
   * The returned promise resolves once the first sweep completes, so callers can
   * await an accurate healthy set before serving traffic (e.g. before the HTTP
   * server starts listening).
   *
   * Subsequent polls are scheduled at `pollIntervalMs`. Safe to call only once.
   */
  async start(): Promise<void> {
    await this.poll();
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, this.options.pollIntervalMs);
  }

  /**
   * Stop the background poll loop.
   *
   * Clears the interval; in-flight polls are allowed to finish normally.
   */
  stop(): void {
    if (this.pollTimer !== undefined) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  /**
   * Wrap a `FacilitatorKeetaSigner` so that `getAddresses()` only reports
   * fee-payer accounts the pool currently considers healthy (sufficient
   * KTA balance to pay network fees).
   *
   * The `ExactKeetaScheme` selects its fee payer via `signer.getAddresses()`, so
   * filtering here transparently excludes low-balance accounts from settlement.
   *
   * @returns A FacilitatorKeetaSigner that reports only healthy fee-payer addresses.
   */
  getBalanceFilteredSigner(): FacilitatorKeetaSigner {
    return {
      ...this.signer,
      getAddresses: () => this.getSchedulableAddresses(),
    };
  }

  /**
   * Return all fee-payer addresses currently eligible for selection: those at or
   * above `minBalance`, i.e. `healthy` or `degraded` (degraded accounts are still
   * usable while they refill). Only `unhealthy` accounts are excluded.
   *
   * @returns The schedulable addresses, in insertion order.
   */
  getSchedulableAddresses(): string[] {
    const schedulable: string[] = [];
    for (const [addr, s] of this.state) {
      if (s.health !== "unhealthy") schedulable.push(addr);
    }
    return schedulable;
  }

  /**
   * Classify a raw base-token balance into a {@link FeePayerHealth} using the
   * configured thresholds.
   *
   * @param balance - Raw base-token balance in atomic units.
   * @returns The health classification for that balance.
   */
  private classify(balance: bigint): FeePayerHealth {
    if (balance >= this.options.refillThreshold) return "healthy";
    if (balance >= this.options.minBalance) return "degraded";
    return "unhealthy";
  }

  /**
   * Log a fee-payer's health change at a severity matching the new state.
   *
   * @param address - The account whose health changed.
   * @param balance - The raw balance that triggered the transition.
   * @param health  - The account's new health classification.
   */
  private logHealthTransition(
    address: string,
    balance: bigint,
    health: FeePayerHealth,
  ): void {
    switch (health) {
      case "unhealthy":
        this.logger?.warn(
          "fee-payer-pool",
          `${address} balance ${balance} below minBalance ${this.options.minBalance}, marking unhealthy (excluded from selection)`,
        );
        break;
      case "degraded":
        this.logger?.info(
          "fee-payer-pool",
          `${address} balance ${balance} below refillThreshold ${this.options.refillThreshold}, marking degraded (still selectable, refilling)`,
        );
        break;
      case "healthy":
        this.logger?.info(
          "fee-payer-pool",
          `${address} balance ${balance} recovered, marking healthy`,
        );
        break;
    }
  }

  /**
   * Run a balance poll sweep over all known addresses.
   * No-ops if another sweep is already in progress.
   */
  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      await Promise.all(
        Array.from(this.state.entries()).map(async ([addr, entry]) => {
          try {
            const balance = await this.fetchBalance(addr);
            const previous = entry.health;
            entry.health = this.classify(balance);

            if (entry.health !== previous) {
              this.logHealthTransition(addr, balance, entry.health);
            }

            // Refill whenever below the proactive threshold (degraded or
            // unhealthy). maybeRefill is a no-op if no refiller is configured
            // (e.g. mainnet) or one is already in flight for this account.
            if (entry.health !== "healthy") {
              void this.maybeRefill(addr, entry);
            }
          } catch (err) {
            this.logger?.error(
              "fee-payer-pool",
              `Failed to poll balance for ${addr}`,
              err,
            );
          }
        }),
      );
    } finally {
      this.polling = false;
    }
  }

  /**
   * Trigger a refill for the given address if a refiller is configured and
   * no refill is already in flight for that account.
   *
   * Fires the refiller with the exact deficit needed to reach `refillTarget`,
   * then polls every 500 ms (up to 30 s) until the balance recovers.
   *
   * @param address - The account to refill.
   * @param entry   - Mutable state entry for that account.
   */
  private async maybeRefill(
    address: string,
    entry: FeePayerState,
  ): Promise<void> {
    if (!this.options.refiller || entry.refilling) return;

    entry.refilling = true;
    try {
      const balance = await this.fetchBalance(address);
      if (balance >= this.options.refillTarget) {
        entry.health = "healthy";
        return;
      }

      const deficit = this.options.refillTarget - balance;
      this.logger?.info(
        "fee-payer-pool",
        `Triggering refill for ${address}, deficit ${deficit}`,
      );
      await this.options.refiller(address, this.network, deficit);

      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        await KeetaNet.lib.Utils.Helper.asleep(500);
        const current = await this.fetchBalance(address);
        if (current >= this.options.refillTarget) {
          entry.health = "healthy";
          this.logger?.info(
            "fee-payer-pool",
            `${address} refilled, balance ${current}`,
          );
          return;
        }
      }

      this.logger?.warn(
        "fee-payer-pool",
        `${address} still below refillTarget ${this.options.refillTarget} after refill`,
      );
    } catch (err) {
      this.logger?.error("fee-payer-pool", `Refill failed for ${address}`, err);
    } finally {
      entry.refilling = false;
    }
  }

  /**
   * Fetch the base-token balance for the given fee-payer address on the pool's
   * network.
   *
   * @param address - The fee-payer account address.
   * @returns The raw base-token balance in atomic units.
   */
  private async fetchBalance(address: string): Promise<bigint> {
    const userClient = this.signer.getKeetaUserClient(
      address,
      this.network.caip2,
    );
    const baseToken = userClient.baseToken;

    return await userClient.client.getBalance(address, baseToken);
  }
}
