import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const envModuleDir = path.dirname(fileURLToPath(import.meta.url));
const envFilePath = path.resolve(envModuleDir, "../../.env");

// Load local development variables from the workspace root without requiring a .env file in runtime containers.
if (existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
}

export function getConfig() {
  return {
    databaseUrl: process.env.DATABASE_URL ?? "",
    jwtSecret: process.env.JWT_SECRET ?? "",
    port: Number(process.env.PORT ?? 4000),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
    registrationEnabled: process.env.REGISTRATION_ENABLED !== "false",
    smtpHost: process.env.SMTP_HOST ?? "",
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    smtpUser: process.env.SMTP_USER ?? "",
    smtpPass: process.env.SMTP_PASS ?? "",
    smtpFrom: process.env.SMTP_FROM ?? "",
    smtpFromName: process.env.SMTP_FROM_NAME ?? "",
    appBaseUrl: process.env.APP_BASE_URL ?? "",
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? "",
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
    vapidContact: process.env.VAPID_CONTACT ?? "",
    logLevel: process.env.LOG_LEVEL ?? "info",
    // Opt-in only: the /api/test/* routes mint verified users and must never be reachable by default.
    enableTestRoutes: process.env.ENABLE_TEST_ROUTES === "true"
  };
}

const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Checks the settings the server cannot run safely without.
 * @param {{ databaseUrl?: string, jwtSecret?: string }} config Runtime configuration.
 * @returns {string[]} Human-readable problems; empty when the configuration is usable.
 */
export function validateConfig(config) {
  const problems = [];
  const secret = config.jwtSecret ?? "";

  if (!config.databaseUrl) {
    problems.push("DATABASE_URL is not set.");
  }

  if (!secret) {
    problems.push("JWT_SECRET is not set.");
  } else if (secret.length < MIN_JWT_SECRET_LENGTH) {
    problems.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long.`);
  } else if (secret.toLowerCase().includes("change-me")) {
    problems.push("JWT_SECRET still contains the 'change-me' placeholder.");
  }

  return problems;
}
