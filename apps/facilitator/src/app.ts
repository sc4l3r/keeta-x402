import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { x402Facilitator } from "@x402/core/facilitator";
import { Log as Logger } from "@keetanetwork/anchor/lib/log/index.js";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import type { AppConfig } from "./config.js";
import { mountRoutes } from "./routes.js";
import { mountDemoServer } from "./demo-server.js";
import type { FeePayerPool } from "./fee-payer-pool.js";
import {
  metricsMiddleware,
  registerPoolHealthCollection,
  setMetricsEnabled,
} from "./metrics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildApp(
  config: AppConfig,
  accounts: InstanceType<typeof KeetaNet.lib.Account>[],
  facilitator: InstanceType<typeof x402Facilitator>,
  pools: FeePayerPool[],
  logger: InstanceType<typeof Logger>,
): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  setMetricsEnabled(config.metricsEnabled);

  // Record HTTP metrics for every request.
  // Mount before routes so unmatched requests are captured too.
  if (config.metricsEnabled) {
    app.use(metricsMiddleware());
    registerPoolHealthCollection(pools);
  }

  mountRoutes(
    app,
    facilitator,
    accounts,
    config.enabledNetworks,
    {
      minBalanceKta: config.minFeeBalanceKta,
      refillThresholdKta: config.refillThresholdKta,
    },
    logger,
    { enabled: config.metricsEnabled, token: config.metricsToken },
  );
  mountDemoServer(
    app,
    config.enabledNetworks,
    config.serverAddress,
    config.port,
    logger,
  );

  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));
  app.get("/", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  return app;
}
