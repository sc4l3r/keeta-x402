// Inspired by https://github.com/coinbase/x402/tree/main/examples/typescript/facilitator

import dotenv from "dotenv";
import express from "express";

import { Log as Logger } from "@keetanetwork/anchor/lib/log/index.js";
import LogTargetConsole from "@keetanetwork/anchor/lib/log/target_console.js";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import { x402Facilitator } from "@x402/core/facilitator";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { toFacilitatorKeetaSigner, KEETA_TESTNET_CAIP2 } from "@x402/keeta";
import { ExactKeetaScheme } from "@x402/keeta/exact/facilitator";

type LogTargetLevel = NonNullable<
  NonNullable<ConstructorParameters<typeof LogTargetConsole>[0]>["logLevel"]
>;

dotenv.config({
  path: '../../.env'
});

async function main() {
  if (!process.env.FACILITATOR_PASSPHRASE) {
    console.error("FACILITATOR_PASSPHRASE environment variable is not set");
    return;
  }

  const logLevel = (process.env.APP_LOG_LEVEL ?? "INFO") as LogTargetLevel;
  const logger = new Logger();
  logger.registerTarget(new LogTargetConsole({ logLevel }));
  logger.startAutoSync();

  const account = KeetaNet.lib.Account.fromSeed(
    await KeetaNet.lib.Account.seedFromPassphrase(
      process.env.FACILITATOR_PASSPHRASE,
    ),
    0,
  );

  // Initialize the x402 Facilitator with Keeta support
  const keetaSigner = toFacilitatorKeetaSigner([account]);

  const facilitator = new x402Facilitator()
    .onBeforeVerify(async (context) => {
      logger.debug("Before verify", context);
    })
    .onAfterVerify(async (context) => {
      logger.debug("After verify", context);
    })
    .onVerifyFailure(async (context) => {
      logger.error("Verify failure", context);
    })
    .onBeforeSettle(async (context) => {
      logger.debug("Before settle", context);
    })
    .onAfterSettle(async (context) => {
      logger.info("Transaction settled", context);
    })
    .onSettleFailure(async (context) => {
      logger.error("Settle failure", context);
    });

  facilitator.register(KEETA_TESTNET_CAIP2, new ExactKeetaScheme(keetaSigner));

  // Initialize Express app
  const app = express();
  app.use(express.json());

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
      console.error("Verify error:", error);
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
      console.error("Settle error:", error);

      // Check if this was an abort from hook
      if (
        error instanceof Error &&
        error.message.includes("Settlement aborted:")
      ) {
        // Return a proper SettleResponse instead of 500 error
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

  /**
   * GET /supported
   * Get supported payment kinds and extensions
   */
  app.get("/supported", async (req, res) => {
    try {
      const response = facilitator.getSupported();
      res.json(response);
    } catch (error) {
      logger.error("Supported error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Start the server
  const port = parseInt(process.env.PORT || "4022");
  const server = app.listen(port, () => {
    logger.info(`Facilitator listening at http://localhost:${port}`);
  });

  const shutdown = async () => {
    logger.info("Shutting down...");

    logger.stopAutoSync();
    await logger.sync();

    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error("Facilitator stopped with error:", error);
  process.exit(1);
});
