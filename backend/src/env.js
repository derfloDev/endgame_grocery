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
    logLevel: process.env.LOG_LEVEL ?? "info"
  };
}
