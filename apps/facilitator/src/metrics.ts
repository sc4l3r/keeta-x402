import {
  Registry,
  Counter,
  Gauge,
  Histogram,
  collectDefaultMetrics,
} from "prom-client";
import type { Request, Response, NextFunction } from "express";
import type { Network } from "@x402/core/types";
import type { FeePayerPool } from "./fee-payer-pool.js";
import { getBaseTokenInfo } from "./token.js";
import { networkToKeetaNetwork } from "@x402/keeta";

export const registry = new Registry();

/** Prefix applied to every facilitator-defined metric. */
const PREFIX = "facilitator_";

const verificationsTotal = new Counter({
  name: `${PREFIX}verifications_total`,
  help: "Total payment verifications by network, scheme and result",
  labelNames: ["network", "scheme", "result"] as const,
  registers: [registry],
});

const settlementsTotal = new Counter({
  name: `${PREFIX}settlements_total`,
  help: "Total payment settlements by network, result and reason",
  labelNames: ["network", "result", "reason"] as const,
  registers: [registry],
});

const verificationDurationSeconds = new Histogram({
  name: `${PREFIX}verification_duration_seconds`,
  help: "Verification latency in seconds by network and result",
  labelNames: ["network", "result"] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [registry],
});

const settlementDurationSeconds = new Histogram({
  name: `${PREFIX}settlement_duration_seconds`,
  help: "Settlement latency in seconds by network and result",
  labelNames: ["network", "result"] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [registry],
});

const httpRequestsTotal = new Counter({
  name: `${PREFIX}http_requests_total`,
  help: "Total HTTP requests by method, route and status code",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [registry],
});

const httpRequestDurationSeconds = new Histogram({
  name: `${PREFIX}http_request_duration_seconds`,
  help: "HTTP request latency in seconds by method, route and status code",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

const settlementQueueDepth = new Gauge({
  name: `${PREFIX}settlement_queue_depth`,
  help: "In-flight settlement queue depth per fee payer and network",
  labelNames: ["network", "fee_payer"] as const,
  registers: [registry],
});

let defaultMetricsStarted = false;

/**
 * Start collecting Node.js runtime metrics (event-loop lag, heap, GC).
 */
export function startDefaultMetricsCollection(): void {
  if (defaultMetricsStarted) return;
  defaultMetricsStarted = true;
  collectDefaultMetrics({ register: registry });
}

let poolsForCollection: readonly FeePayerPool[] = [];

export function registerPoolHealthCollection(
  pools: readonly FeePayerPool[],
): void {
  poolsForCollection = pools;
}

const feePayerHealthCount = new Gauge({
  name: `${PREFIX}fee_payer_health_count`,
  help: "Number of fee-payer accounts in each health state, per network",
  labelNames: ["network", "health"] as const,
  registers: [registry],
  // Refreshed on demand from each pool's snapshot when this metric is scraped.
  collect() {
    for (const pool of poolsForCollection) {
      const network = pool.networkId.network;
      const { health } = pool.getHealthSnapshot();
      this.set({ network, health: "healthy" }, health.healthy);
      this.set({ network, health: "degraded" }, health.degraded);
      this.set({ network, health: "unhealthy" }, health.unhealthy);
    }
  },
});

type AccountsInfoEntry = {
  promise: ReturnType<FeePayerPool["fetchAccountsInfo"]>;
  expiresAt: number;
};
const accountsInfoCache = new WeakMap<FeePayerPool, AccountsInfoEntry>();
const ACCOUNTS_INFO_TTL_MS = 5_000;

function cachedAccountsInfo(pool: FeePayerPool) {
  const now = Date.now();
  const hit = accountsInfoCache.get(pool);
  if (hit && now < hit.expiresAt) return hit.promise;
  const promise = pool.fetchAccountsInfo();
  accountsInfoCache.set(pool, { promise, expiresAt: now + ACCOUNTS_INFO_TTL_MS });
  return promise;
}

const feePayerBalance = new Gauge({
  name: `${PREFIX}fee_payer_balance`,
  help: "Decimalized base-token balance per fee-payer account and network, fetched on scrape",
  labelNames: ["address", "network"] as const,
  registers: [registry],
  async collect() {
    for (const pool of poolsForCollection) {
      const net = pool.networkId.network;
      try {
        const [infos, tokenInfo] = await Promise.all([
          cachedAccountsInfo(pool),
          getBaseTokenInfo(pool.networkId),
        ]);
        const divisor = 10n ** BigInt(tokenInfo.decimals);
        for (const { address, balance } of infos) {
          const whole = balance / divisor;
          const remainder = balance % divisor;
          this.set(
            { address, network: net },
            Number(whole) + Number(remainder) / Number(divisor),
          );
        }
      } catch {
        // Best-effort: if the chain fetch fails, omit this scrape cycle's values
        // rather than serving stale data.
      }
    }
  },
});

const feePayerBlockHeight = new Gauge({
  name: `${PREFIX}fee_payer_block_height`,
  help: "Block height per fee-payer account and network",
  labelNames: ["address", "network"] as const,
  registers: [registry],
  async collect() {
    for (const pool of poolsForCollection) {
      const net = pool.networkId.network;
      try {
        const infos = await cachedAccountsInfo(pool);
        for (const { address, blockHeight } of infos) {
          this.set({ address, network: net }, Number(blockHeight));
        }
      } catch {
        // Best-effort: if the chain fetch fails, omit this scrape cycle's values
        // rather than serving stale data.
      }
    }
  },
});

function toNetworkLabel(network: Network): string {
  try {
    return networkToKeetaNetwork(network);
  } catch {
    return "unknown";
  }
}

/**
 * Normalize an error reason / class name into a bounded label value to keep
 * Prometheus label cardinality low. Lowercases, replaces non-alphanumerics with
 * underscores, and truncates. Raw error messages must never be passed in.
 *
 * @param reason - A short, bounded reason (e.g. `errorReason` or error class).
 * @returns A safe, bounded label value, or `unknown` when absent.
 */
function normalizeReason(reason: string | undefined): string {
  if (!reason) return "unknown";
  return reason
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

const KNOWN_SETTLEMENT_REASONS = new Set([
  // x402/keeta ExactKeetaScheme.settle() -> response.errorReason
  "verification_failed",
  "duplicate_block",
  "transaction_failed",
  // Synthetic reason for unrecognised / missing values
  "unknown",
  "ok",
]);

function boundedReason(reason: string): string {
  return KNOWN_SETTLEMENT_REASONS.has(reason) ? reason : "other";
}

let recordingEnabled = false;
export function setMetricsEnabled(enabled: boolean): void {
  recordingEnabled = enabled;
}

export function recordVerification(input: {
  network: Network;
  scheme: string;
  outcome: "valid" | "invalid" | "error";
  durationSeconds: number;
}): void {
  if (!recordingEnabled) return;
  const network = toNetworkLabel(input.network);
  verificationsTotal.inc({ network, scheme: input.scheme, result: input.outcome });
  verificationDurationSeconds.observe({ network, result: input.outcome }, input.durationSeconds);
}

export function recordSettlement(input: {
  network: Network;
  outcome: "success" | "failure" | "error";
  reason?: string;
  durationSeconds: number;
}): void {
  if (!recordingEnabled) return;
  const network = toNetworkLabel(input.network);
  const rawReason =
    input.outcome === "success" ? "ok" : normalizeReason(input.reason);
  const reason = boundedReason(rawReason);
  settlementsTotal.inc({ network, result: input.outcome, reason });
  settlementDurationSeconds.observe({ network, result: input.outcome }, input.durationSeconds);
}

export function incSettlementQueueDepth(feePayer: string, network: Network): void {
  if (!recordingEnabled) return;
  settlementQueueDepth.inc({ fee_payer: feePayer, network: toNetworkLabel(network) });
}

export function decSettlementQueueDepth(feePayer: string, network: Network): void {
  if (!recordingEnabled) return;
  settlementQueueDepth.dec({ fee_payer: feePayer, network: toNetworkLabel(network) });
}

/**
 * Express middleware that records request count and latency. Mount it before the
 * route handlers so every request (excluding unmatched ones) is captured.
 *
 * @returns An Express request handler.
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const end = httpRequestDurationSeconds.startTimer();
    res.on("finish", () => {
      const route = req.route?.path ?? "unmatched";
      const labels = {
        method: req.method,
        route: String(route),
        status_code: String(res.statusCode),
      };
      end(labels);
      httpRequestsTotal.inc(labels);
    });
    next();
  };
}
