// Inspired by https://github.com/coinbase/x402/tree/main/examples/typescript/facilitator

import dotenv from "dotenv";
import express from "express";

import * as KeetaNet from "@keetanetwork/keetanet-client";
import { x402Facilitator } from "@x402/core/facilitator";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { toFacilitatorKeetaSigner, KEETA_TESTNET_CAIP2 } from "@x402/keeta";
import { registerExactKeetaScheme } from "@x402/keeta/exact/facilitator";

dotenv.config();

async function main() {
  if (!process.env.FACILITATOR_PASSPHRASE) {
    console.error("FACILITATOR_PASSPHRASE environment variable is not set");
    return;
  }

  const feeSponsored = process.env.FACILITATOR_SPONSOR_FEES === "true";

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
      console.log("Before verify", context);
    })
    .onAfterVerify(async (context) => {
      console.log("After verify", context);
    })
    .onVerifyFailure(async (context) => {
      console.log("Verify failure", context);
    })
    .onBeforeSettle(async (context) => {
      console.log("Before settle", context);
    })
    .onAfterSettle(async (context) => {
      console.log("After settle", context);
    })
    .onSettleFailure(async (context) => {
      console.log("Settle failure", context);
    });

  // Register Keeta scheme using the register helper
  registerExactKeetaScheme(facilitator, {
    signer: keetaSigner,
    // Keeta Testnet
    networks: KEETA_TESTNET_CAIP2,
    feeSponsored,
  });

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
      console.error("Supported error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Start the server
  app.listen(4022, () => {
    console.log("Facilitator listening at http://localhost:4022");
  });
}

main()
  .then(() => {
    console.log("Facilitator stopped");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Facilitator stopped with error:", error);
    process.exit(1);
  });
