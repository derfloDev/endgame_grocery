import { createApp } from "./app.js";
import { getConfig } from "./env.js";
import { logger as defaultLogger } from "./logger.js";
import { fileURLToPath } from "node:url";

export function startServer(options = {}) {
  const logger = options.logger ?? defaultLogger;
  const config = options.config ?? getConfig();
  const app = options.app ?? createApp({ logger });
  const { port } = config;

  return app.listen(port, () => {
    logger.info(
      {
        port,
        dbConfigured: Boolean(config.databaseUrl),
        smtpConfigured: Boolean(config.smtpHost),
        vapidConfigured: Boolean(config.vapidPublicKey && config.vapidPrivateKey),
        logLevel: config.logLevel
      },
      "Backend started"
    );
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer();
}
