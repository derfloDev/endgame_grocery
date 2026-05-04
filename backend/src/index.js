import { readFileSync } from "node:fs";
import path from "node:path";
import { createApp } from "./app.js";
import { getConfig } from "./env.js";
import { logger as defaultLogger } from "./logger.js";
import { fileURLToPath } from "node:url";

const backendSrcDir = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(path.resolve(backendSrcDir, "../../package.json"), "utf8"));

export function startServer(options = {}) {
  const logger = options.logger ?? defaultLogger;
  const config = options.config ?? getConfig();
  const app = options.app ?? createApp({ logger, config });
  const { port } = config;

  return app.listen(port, () => {
    logger.info(
      {
        port,
        version: packageJson.version,
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
