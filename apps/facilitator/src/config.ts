import dotenv from "dotenv";
import type { Network } from "@x402/core/types";
import { KEETA_TESTNET_CAIP2, KEETA_MAINNET_CAIP2 } from "@x402/keeta";
import type { Networks } from "@keetanetwork/keetanet-client/config/index.js";

dotenv.config({ path: "../../.env" });

type LogTargetLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export type NetworkIDs = {
  network: Networks;
  caip2: Network;
};

// Maps the short network id used in KEETA_NETWORKS to its CAIP-2 identifier
// and the KeetaNet SDK network alias.
export const KNOWN_NETWORKS: Record<string, NetworkIDs> = {
  test: { caip2: KEETA_TESTNET_CAIP2, network: "test" },
  main: { caip2: KEETA_MAINNET_CAIP2, network: "main" },
};

export type AppConfig = {
  /**
   * Passphrase to derive the facilitator accounts from.
   */
  passphrase: string;
  /**
   * Networks enabled for this facilitator.
   */
  enabledNetworks: NetworkIDs[];
  /**
   * Amount of fee payer accounts to derive. More accounts enable processing
   * of more requests in parallel.
   */
  amountAccounts: number;
  /**
   * Port for the HTTP server to listen on.
   */
  port: number;
  /**
   * Log level used for logging.
   */
  logLevel: LogTargetLevel;
  /**
   * KTA address of the demo resource server.
   */
  serverAddress: string | undefined;
  /**
   * Minimum base-token balance in KTA (e.g. "0.1") below which a fee-payer
   * account is excluded from selection. Converted to raw units per-network
   * using that network's decimal count.
   */
  minFeeBalanceKta: string;
  /**
   * Base-token balance in KTA (e.g. "2") below which a fee-payer account is
   * considered "degraded" and proactively refilled while still remaining
   * eligible for selection. Sits between minFeeBalanceKta and refillTargetKta so
   * accounts are topped up before they ever drop below the hard minimum and get
   * excluded. Converted to raw units per-network.
   */
  refillThresholdKta: string;
  /**
   * Base-token balance in KTA an account must reach after a refill
   * before it is re-admitted as healthy. Should be higher than minFeeBalanceKta to
   * avoid flapping right at the threshold.
   */
  refillTargetKta: string;
  /**
   * How often (ms) to poll all fee-payer accounts' balances.
   */
  pollIntervalMs: number;
};

/**
 * Convert a KTA amount string (e.g. "0.1", "5") to raw atomic units for the given decimal precision.
 */
export function ktaToRaw(kta: string, decimals: number): bigint {
  const [intPart = "", fracPart = ""] = kta.split(".");
  if (fracPart.length > decimals) {
    throw new Error(`"${kta}" has more than ${decimals} decimal places`);
  }
  const paddedFrac = fracPart.padEnd(decimals, "0");
  return BigInt(intPart) * 10n ** BigInt(decimals) + BigInt(paddedFrac);
}

function resolveEnabledNetworks(raw: string): NetworkIDs[] {
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const result: NetworkIDs[] = [];
  for (const id of ids) {
    const entry = KNOWN_NETWORKS[id];
    if (!entry) {
      console.error(
        `Unknown network "${id}" in KEETA_NETWORKS. Valid values: ${Object.keys(KNOWN_NETWORKS).join(", ")}`,
      );
      process.exit(1);
    }
    result.push(entry);
  }
  if (result.length === 0) {
    console.error("KEETA_NETWORKS must list at least one network (test, main)");
    process.exit(1);
  }
  return result;
}

export function loadConfig(): AppConfig {
  if (!process.env.FACILITATOR_PASSPHRASE) {
    console.error("FACILITATOR_PASSPHRASE environment variable is not set");
    process.exit(1);
  }

  const rawNetworks = process.env.KEETA_NETWORKS ?? "test,main";
  const enabledNetworks = resolveEnabledNetworks(rawNetworks);

  const rawAmountAccounts = process.env.FACILITATOR_AMOUNT_ACCOUNTS ?? "1";
  const amountAccounts = parseInt(rawAmountAccounts, 10);
  if (!Number.isInteger(amountAccounts) || amountAccounts < 1) {
    console.error(
      "FACILITATOR_AMOUNT_ACCOUNTS must be a positive integer, got: " +
        rawAmountAccounts,
    );
    process.exit(1);
  }

  const rawPort = process.env.PORT ?? "4022";
  const port = parseInt(rawPort, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(
      "PORT must be an integer between 1 and 65535, got: " + rawPort,
    );
    process.exit(1);
  }

  const logLevel = (process.env.APP_LOG_LEVEL ?? "INFO") as LogTargetLevel;

  const rawMinFeeBalanceKta =
    process.env.FACILITATOR_MIN_FEE_BALANCE_KTA ?? "1";
  const minFeeBalanceKta = parseFloat(rawMinFeeBalanceKta);
  if (minFeeBalanceKta <= 0) {
    console.error(
      `FACILITATOR_MIN_FEE_BALANCE_KTA must be a positive decimal number (e.g. "0.1" or "1"), got: ${minFeeBalanceKta}`,
    );
    process.exit(1);
  }

  const rawRefillThresholdKta =
    process.env.FACILITATOR_REFILL_THRESHOLD_KTA ?? "2";
  const refillThresholdKta = parseFloat(rawRefillThresholdKta);
  if (refillThresholdKta <= 0) {
    console.error(
      `FACILITATOR_REFILL_THRESHOLD_KTA must be a positive decimal number (e.g. "2"), got: ${refillThresholdKta}`,
    );
    process.exit(1);
  }

  const rawRefillTargetKta = process.env.FACILITATOR_REFILL_TARGET_KTA ?? "10";
  const refillTargetKta = parseFloat(rawRefillTargetKta);
  if (refillTargetKta <= 0) {
    console.error(
      `FACILITATOR_REFILL_TARGET_KTA must be a positive decimal number (e.g. "1" or "10"), got: ${refillTargetKta}`,
    );
    process.exit(1);
  }

  // Thresholds must be ordered min <= degraded(refill) <= target, otherwise an
  // account could be "degraded" below the hard minimum, or a refill could target
  // less than it requires.
  if (
    !(minFeeBalanceKta <= refillThresholdKta &&
      refillThresholdKta <= refillTargetKta)
  ) {
    console.error(
      `Fee balance thresholds must satisfy FACILITATOR_MIN_FEE_BALANCE_KTA (${minFeeBalanceKta}) <= ` +
        `FACILITATOR_REFILL_THRESHOLD_KTA (${refillThresholdKta}) <= ` +
        `FACILITATOR_REFILL_TARGET_KTA (${refillTargetKta})`,
    );
    process.exit(1);
  }

  const rawPollInterval = process.env.FACILITATOR_POLL_INTERVAL_MS ?? "30000";
  const pollIntervalMs = parseInt(rawPollInterval, 10);
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 1) {
    console.error(
      "FACILITATOR_POLL_INTERVAL_MS must be a positive integer, got: " +
        rawPollInterval,
    );
    process.exit(1);
  }

  const testnetEnabled = enabledNetworks.some((n) => n.network === "test");
  const serverAddress = process.env.SERVER_ADDRESS;
  if (testnetEnabled && !serverAddress) {
    console.error(
      "SERVER_ADDRESS is required when testnet is in KEETA_NETWORKS (used by the demo /weather route)",
    );
    process.exit(1);
  }

  return {
    passphrase: process.env.FACILITATOR_PASSPHRASE,
    enabledNetworks,
    amountAccounts,
    port,
    logLevel,
    serverAddress,
    minFeeBalanceKta: rawMinFeeBalanceKta,
    refillThresholdKta: rawRefillThresholdKta,
    refillTargetKta: rawRefillTargetKta,
    pollIntervalMs,
  };
}
