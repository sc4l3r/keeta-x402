import { Log as Logger } from "@keetanetwork/anchor/lib/log/index.js";
import LogTargetConsole from "@keetanetwork/anchor/lib/log/target_console.js";
import { loadConfig } from "./config.js";
import { deriveAccounts } from "./accounts.js";
import { buildFacilitator } from "./facilitator.js";
import { buildApp } from "./app.js";

type LogTargetLevel = NonNullable<
  NonNullable<ConstructorParameters<typeof LogTargetConsole>[0]>["logLevel"]
>;

async function main() {
  const config = loadConfig();

  const logger = new Logger();
  logger.registerTarget(
    new LogTargetConsole({ logLevel: config.logLevel as LogTargetLevel }),
  );
  logger.startAutoSync();

  logger.info("main", `Starting facilitator with ${config.amountAccounts} accounts`);
  logger.info(
    "main",
    `Networks: ${config.enabledNetworks.map((n) => `${n.network} (${n.caip2})`).join(", ")}`,
  );

  const accounts = await deriveAccounts(
    config.passphrase,
    config.amountAccounts,
    logger,
  );
  const facilitator = buildFacilitator(accounts, config.enabledNetworks, logger);
  const app = buildApp(config, accounts, facilitator, logger);

  const server = app.listen(config.port, () => {
    logger.info("main", `Facilitator listening at http://localhost:${config.port}`);
  });

  const shutdown = async () => {
    logger.info("main", "Shutting down...");
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
