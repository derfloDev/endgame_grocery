import dotenv from "dotenv";

dotenv.config();

export function getConfig() {
  return {
    databaseUrl: process.env.DATABASE_URL ?? "",
    jwtSecret: process.env.JWT_SECRET ?? "",
    port: Number(process.env.PORT ?? 4000),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d"
  };
}
