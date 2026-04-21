import pg from "pg";
import { getConfig } from "../env.js";

const { Pool } = pg;

export function createPool() {
  const { databaseUrl } = getConfig();

  if (!databaseUrl) {
    return null;
  }

  return new Pool({
    connectionString: databaseUrl
  });
}
