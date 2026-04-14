// Inspired by https://github.com/coinbase/x402/tree/main/examples/typescript/servers/express

import dotenv from "dotenv";
import express from "express";

import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware } from "@x402/express";
import { KEETA_TESTNET_CAIP2 } from "@x402/keeta";
import { ExactKeetaScheme } from "@x402/keeta/exact/server";

dotenv.config({
  path: '../../.env'
});

function main() {
  const app = express();

  if (!process.env.SERVER_ADDRESS) {
    console.error("SERVER_ADDRESS environment variable is not set");
    return;
  }
  const payTo = process.env.SERVER_ADDRESS;

  // Create facilitator client
  const facilitatorClient = new HTTPFacilitatorClient({
    url: process.env.FACILITATOR_URL || "http://localhost:4022",
  });

  // Create resource server and register Keeta scheme
  const server = new x402ResourceServer(facilitatorClient);
  server.register(KEETA_TESTNET_CAIP2, new ExactKeetaScheme());

  app.use(
    paymentMiddleware(
      {
        "GET /weather": {
          accepts: [
            {
              scheme: "exact",
              price: {
                // Testnet KTA
                asset:
                  "keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52",
                // 0.000001 testnet KTA
                amount: "1000",
              },
              // Keeta testnet (CAIP-2 format)
              network: KEETA_TESTNET_CAIP2,
              payTo,
            },
          ],
          description: "Get current weather data for any location",
          mimeType: "application/json",
        },
      },
      server,
    ),
  );

  app.get("/weather", (req, res) => {
    res.send({
      report: {
        weather: "sunny",
        temperature: 70,
      },
    });
  });

  const port = parseInt(process.env.PORT || "4021");
  const httpServer = app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });

  const shutdown = () => {
    console.log("Shutting down...");
    httpServer.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();
