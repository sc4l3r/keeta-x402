import { x402Facilitator } from "@x402/core/facilitator";
import { toFacilitatorKeetaSigner } from "@x402/keeta";
import { ExactKeetaScheme } from "@x402/keeta/exact/facilitator";
import { Log as Logger } from "@keetanetwork/anchor/lib/log/index.js";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import type { AppConfig, NetworkIDs } from "./config.js";
import { ktaToRaw } from "./config.js";
import { faucetRefiller, FeePayerPool } from "./fee-payer-pool.js";
import { getBaseTokenInfo } from "./token.ts";

/** Resources that must be cleaned up on process shutdown. */
export type FacilitatorResources = {
  facilitator: InstanceType<typeof x402Facilitator>;
  pools: FeePayerPool[];
};

/**
 * Build the x402 facilitator for the given accounts and networks, registering
 * an `ExactKeetaScheme` per enabled network whose fee-payer selection is gated
 * by a balance-filtered signer.
 *
 * Each network gets a `FeePayerPool` that polls account balances and excludes
 * low-balance accounts from selection. On testnet a faucet-backed `Refiller`
 * tops those accounts back up automatically; mainnet has no refiller, so
 * low-balance accounts stay excluded until refilled out of band.
 *
 * @param accounts        - Derived fee-payer signing accounts
 * @param enabledNetworks - The networks to register (from `AppConfig`)
 * @param config          - Full application config (fee balance thresholds etc.)
 * @param logger          - Logger
 * @returns Facilitator instance and the created pools for lifecycle management.
 */
export async function buildFacilitator(
  accounts: InstanceType<typeof KeetaNet.lib.Account>[],
  enabledNetworks: NetworkIDs[],
  config: Pick<
    AppConfig,
    | "minFeeBalanceKta"
    | "refillThresholdKta"
    | "refillTargetKta"
    | "pollIntervalMs"
  >,
  logger: InstanceType<typeof Logger>,
): Promise<FacilitatorResources> {
  const keetaSigner = toFacilitatorKeetaSigner(accounts);

  const facilitator = new x402Facilitator()
    .onBeforeVerify(async (context) => {
      logger.debug("facilitator", "Before verify", context);
    })
    .onAfterVerify(async (context) => {
      logger.debug("facilitator", "After verify", context);
    })
    .onVerifyFailure(async (context) => {
      logger.error("facilitator", "Verify failure", context);
    })
    .onBeforeSettle(async (context) => {
      logger.debug("facilitator", "Before settle", context);
    })
    .onAfterSettle(async (context) => {
      logger.debug("facilitator", "Transaction settled", context);
    })
    .onSettleFailure(async (context) => {
      logger.error("facilitator", "Settle failure", context);
    });

  const pools: FeePayerPool[] = [];

  for (const network of enabledNetworks) {
    const baseTokenInfo = await getBaseTokenInfo(network);

    // On testnet, low-balance accounts are topped up from the faucet; mainnet
    // has none, so they simply stay excluded until refilled out of band.
    const refiller =
      network.network === "test"
        ? faucetRefiller(logger, baseTokenInfo)
        : undefined;

    const pool = new FeePayerPool(keetaSigner, network, {
      minBalance: ktaToRaw(config.minFeeBalanceKta, baseTokenInfo.decimals),
      refillThreshold: ktaToRaw(
        config.refillThresholdKta,
        baseTokenInfo.decimals,
      ),
      refillTarget: ktaToRaw(config.refillTargetKta, baseTokenInfo.decimals),
      pollIntervalMs: config.pollIntervalMs,
      refiller,
      logger,
    });

    // Filter fee-payer selection through the pool to only use healthy accounts for settlement
    const filteredSigner = pool.getBalanceFilteredSigner();
    const scheme = new ExactKeetaScheme(filteredSigner, logger);

    // Start polling after the scheme (and its queue) are built, so the queue's
    // eager per-account runner creation sees the optimistic all-healthy state.
    // Await the first sweep so low-balance accounts are excluded before we
    // return and the HTTP server starts listening; otherwise the first request
    // after a (cold) start could be settled through an unhealthy fee payer
    // while the initial poll is still in flight.
    await pool.start();
    pools.push(pool);

    facilitator.register(network.caip2, scheme);
  }

  return { facilitator, pools };
}
