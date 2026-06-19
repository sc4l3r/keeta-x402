import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { x402Facilitator } from "@x402/core/facilitator";
import { Log as Logger } from "@keetanetwork/anchor/lib/log/index.js";
import * as KeetaNet from "@keetanetwork/keetanet-client";
import type { AppConfig } from "./config.js";
import { mountRoutes } from "./routes.js";
import { mountDemoServer } from "./demo-server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildApp(
  config: AppConfig,
  accounts: InstanceType<typeof KeetaNet.lib.Account>[],
  facilitator: InstanceType<typeof x402Facilitator>,
  logger: InstanceType<typeof Logger>,
): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  mountRoutes(app, facilitator, accounts, config.enabledNetworks, logger);
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
