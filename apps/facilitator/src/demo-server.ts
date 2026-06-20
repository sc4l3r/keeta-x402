import type { Express } from "express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware } from "@x402/express";
import { KEETA_TESTNET_CAIP2, KTA_TESTNET_ADDRESS } from "@x402/keeta";
import { ExactKeetaScheme as ServerExactKeetaScheme } from "@x402/keeta/exact/server";
import { Log as Logger } from "@keetanetwork/anchor/lib/log/index.js";
import type { NetworkIDs } from "./config.js";

/**
 * Configures an example x402ResourceServer that uses this facilitator and provides
 * a demo `/weather` route on the Express app when testnet is among the
 * enabled networks.
 */
export async function mountDemoServer(
  app: Express,
  enabledNetworks: NetworkIDs[],
  serverAddress: string | undefined,
  port: number,
  logger: InstanceType<typeof Logger>,
): Promise<void> {
  const testnetEnabled = enabledNetworks.some((n) => n.network === "test");
  if (!testnetEnabled) return;

  if (!serverAddress) {
    logger.error(
      "demo",
      "SERVER_ADDRESS is required for the testnet demo route but was not set",
    );
    return;
  }

  const facilitatorClient = new HTTPFacilitatorClient({
    url: `http://localhost:${port}`,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient);
  resourceServer.register(KEETA_TESTNET_CAIP2, new ServerExactKeetaScheme());

  app.use(
    paymentMiddleware(
      {
        "GET /weather": {
          accepts: [
            {
              scheme: "exact",
              price: {
                asset: KTA_TESTNET_ADDRESS,
                // 0.001 testnet KTA (9 decimal places)
                amount: "1000000",
              },
              network: KEETA_TESTNET_CAIP2,
              payTo: serverAddress,
            },
            {
              scheme: "exact",
              price: "$0.001",
              network: KEETA_TESTNET_CAIP2,
              payTo: serverAddress,
            },
          ],
          description: "Get current weather data (demo endpoint)",
          mimeType: "application/json",
        },
      },
      resourceServer,
    ),
  );

  app.get("/weather", (_req, res) => {
    res.json({
      report: {
        weather: "sunny",
        temperature: 70,
      },
    });
  });

  logger.info("demo", "Demo resource route /weather active (testnet)");
}
