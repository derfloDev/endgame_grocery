import pg from "pg";
import { getConfig } from "../env.js";

const { Pool } = pg;
let pool;

export function createPool() {
  const { databaseUrl } = getConfig();

  if (!databaseUrl) {
    return null;
  }

  return new Pool({
    connectionString: databaseUrl
  });
}

export function getPool() {
  if (!pool) {
    pool = createPool();
  }

  return pool;
}

export async function closePool() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
}
