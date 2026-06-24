import { timingSafeEqual } from "node:crypto";
import type { Express } from "express";
import { Log as Logger } from "@keetanetwork/anchor/lib/log/index.js";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import type { x402Facilitator } from "@x402/core/facilitator";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import type { NetworkIDs } from "./config.js";
import { getBaseTokenInfo } from "./token.js";
import { requestFaucet } from "./faucet.js";
import {
  registry,
  recordVerification,
  recordSettlement,
  startDefaultMetricsCollection,
} from "./metrics.js";

export function mountRoutes(
  app: Express,
  facilitator: InstanceType<typeof x402Facilitator>,
  accounts: InstanceType<typeof KeetaNet.lib.Account>[],
  enabledNetworks: NetworkIDs[],
  thresholds: { minBalanceKta: string; refillThresholdKta: string },
  logger: InstanceType<typeof Logger>,
  metricsConfig: { enabled: boolean; token: string | undefined },
): void {
  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  if (metricsConfig.enabled) {
    if (!metricsConfig.token) {
      logger.warn(
        "routes",
        "FACILITATOR_METRICS_TOKEN is not set: the /metrics endpoint is publicly accessible.",
      );
    }

    startDefaultMetricsCollection();

    app.get("/metrics", async (req, res) => {
      if (metricsConfig.token) {
        const auth = req.headers.authorization ?? "";
        const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        const expected = Buffer.from(metricsConfig.token);
        const actual = Buffer.from(provided);
        const ok =
          actual.length === expected.length && timingSafeEqual(actual, expected);
        if (!ok) {
          res.status(401).end();
          return;
        }
      }

      try {
        res.set("Content-Type", registry.contentType);
        res.send(await registry.metrics());
      } catch (error) {
        logger.error("routes", "Metrics error", error);
        res.status(500).end();
      }
    });
  }

  // Returns fee-payer accounts, enabled networks, per-network base token
  // metadata, and the global KTA balance thresholds.
  app.get("/accounts", async (_req, res) => {
    const networksWithMeta = await Promise.all(
      enabledNetworks.map(async (n) => {
        let symbol: string | null = null;
        let decimals: number | null = null;

        try {
          const info = await getBaseTokenInfo(n);
          symbol = info.symbol;
          decimals = info.decimals;
        } catch {
          // Return nulls so the dashboard can display a stale / unknown
          // indicator rather than silently misformatting.
        }

        return {
          network: n.network,
          caip2: n.caip2,
          demoEnabled: n.network === "test",
          symbol,
          decimals,
        };
      }),
    );

    res.json({
      networks: networksWithMeta,
      accounts: accounts.map((a) => a.publicKeyString.toString()),
      thresholds,
    });
  });

  app.post("/verify", async (req, res) => {
    const { paymentPayload, paymentRequirements } = (req.body ?? {}) as {
      paymentPayload?: PaymentPayload;
      paymentRequirements?: PaymentRequirements;
    };

    if (!paymentPayload || !paymentRequirements) {
      return res.status(400).json({
        error: "Missing paymentPayload or paymentRequirements",
      });
    }

    const t0 = performance.now();
    let outcome: "valid" | "invalid" | "error" = "error";
    try {
      const response: VerifyResponse = await facilitator.verify(
        paymentPayload,
        paymentRequirements,
      );
      outcome = response.isValid ? "valid" : "invalid";
      res.json(response);
    } catch (error) {
      outcome = "error";
      logger.error("routes", "Verify error", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      recordVerification({
        network: paymentRequirements.network,
        scheme: paymentRequirements.scheme,
        outcome,
        durationSeconds: (performance.now() - t0) / 1000,
      });
    }
  });

  app.post("/settle", async (req, res) => {
    const { paymentPayload, paymentRequirements } = (req.body ?? {}) as {
      paymentPayload?: PaymentPayload;
      paymentRequirements?: PaymentRequirements;
    };

    if (!paymentPayload || !paymentRequirements) {
      return res.status(400).json({
        error: "Missing paymentPayload or paymentRequirements",
      });
    }

    const t0 = performance.now();
    let outcome: "success" | "failure" | "error" = "error";
    let reason: string | undefined;
    try {
      const response: SettleResponse = await facilitator.settle(
        paymentPayload,
        paymentRequirements,
      );
      if (response.success) {
        outcome = "success";
      } else {
        outcome = "failure";
        reason = response.errorReason;
      }
      res.json(response);
    } catch (error) {
      logger.error("routes", "Settle error", error);

      if (
        error instanceof Error &&
        error.message.includes("Settlement aborted:")
      ) {
        const errorReason = error.message.replace("Settlement aborted: ", "");
        outcome = "failure";
        reason = errorReason;
        return res.json({
          success: false,
          errorReason,
          network: paymentRequirements.network,
        } as SettleResponse);
      }

      outcome = "error";
      reason = error instanceof Error ? error.name : undefined;
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      recordSettlement({
        network: paymentRequirements.network,
        outcome,
        reason,
        durationSeconds: (performance.now() - t0) / 1000,
      });
    }
  });

  // Proxy for testnet faucet to avoid CORS issues from the browser dashboard.
  app.post("/faucet", async (req, res) => {
    const { address } = req.body as { address?: string };
    if (!address || typeof address !== "string") {
      return res.status(400).json({ error: "address required" });
    }
    try {
      await requestFaucet(address, "1");
      res.json({ success: true });
    } catch (err) {
      logger.error("routes", "Faucet proxy error", err);
      res.status(502).json({
        error: err instanceof Error ? err.message : "faucet request failed",
      });
    }
  });

  app.get("/supported", async (_req, res) => {
    try {
      const response = facilitator.getSupported();
      res.json(response);
    } catch (error) {
      logger.error("routes", "Supported error", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}
