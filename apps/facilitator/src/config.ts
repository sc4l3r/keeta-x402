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
  passphrase: string;
  enabledNetworks: NetworkIDs[];
  amountAccounts: number;
  port: number;
  logLevel: LogTargetLevel;
  serverAddress: string | undefined;
};

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
  };
}
