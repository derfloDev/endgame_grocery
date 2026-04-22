import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const envModuleDir = path.dirname(fileURLToPath(import.meta.url));
const envFilePath = path.resolve(envModuleDir, "../../.env");

// Resolve the workspace root `.env` from this module so backend scripts do not depend on process.cwd().
dotenv.config({ path: envFilePath });

export function getConfig() {
  return {
    databaseUrl: process.env.DATABASE_URL ?? "",
    jwtSecret: process.env.JWT_SECRET ?? "",
    port: Number(process.env.PORT ?? 4000),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d"
  };
}
