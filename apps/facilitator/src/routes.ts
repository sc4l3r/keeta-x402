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

export function mountRoutes(
  app: Express,
  facilitator: InstanceType<typeof x402Facilitator>,
  accounts: InstanceType<typeof KeetaNet.lib.Account>[],
  enabledNetworks: NetworkIDs[],
  logger: InstanceType<typeof Logger>,
): void {
  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Returns fee-payer accounts, enabled networks, and per-network base token
  // metadata so the dashboard formats amounts correctly.
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
    });
  });

  app.post("/verify", async (req, res) => {
    try {
      const { paymentPayload, paymentRequirements } = req.body as {
        paymentPayload: PaymentPayload;
        paymentRequirements: PaymentRequirements;
      };

      if (!paymentPayload || !paymentRequirements) {
        return res.status(400).json({
          error: "Missing paymentPayload or paymentRequirements",
        });
      }

      const response: VerifyResponse = await facilitator.verify(
        paymentPayload,
        paymentRequirements,
      );
      res.json(response);
    } catch (error) {
      logger.error("routes", "Verify error", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/settle", async (req, res) => {
    try {
      const { paymentPayload, paymentRequirements } = req.body;

      if (!paymentPayload || !paymentRequirements) {
        return res.status(400).json({
          error: "Missing paymentPayload or paymentRequirements",
        });
      }

      const response: SettleResponse = await facilitator.settle(
        paymentPayload as PaymentPayload,
        paymentRequirements as PaymentRequirements,
      );
      res.json(response);
    } catch (error) {
      logger.error("routes", "Settle error", error);

      if (
        error instanceof Error &&
        error.message.includes("Settlement aborted:")
      ) {
        return res.json({
          success: false,
          errorReason: error.message.replace("Settlement aborted: ", ""),
          network: req.body?.paymentPayload?.network || "unknown",
        } as SettleResponse);
      }

      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Proxy for testnet faucet to avoid CORS issues from the browser dashboard.
  app.post("/faucet", async (req, res) => {
    const { address } = req.body as { address?: string };
    if (!address || typeof address !== "string") {
      return res.status(400).json({ error: "address required" });
    }
    const params = new URLSearchParams();
    params.append("address", address);
    params.append("amount", "1");
    try {
      const resp = await fetch("https://faucet.test.keeta.com", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      if (resp.ok) {
        res.json({ success: true });
      } else {
        res.status(502).json({ error: `Faucet returned ${resp.status}` });
      }
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
