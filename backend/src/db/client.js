import pg from "pg";
import { getConfig } from "../env.js";

const { Pool } = pg;
let pool;

// A request waits at most this long for a free connection before failing instead of hanging.
const CONNECTION_TIMEOUT_MS = 5000;
// Idle connections are closed after this long so a quiet instance does not hold database slots.
const IDLE_TIMEOUT_MS = 30000;

/**
 * Builds the pg pool options from the runtime configuration.
 *
 * @param {{ databaseUrl: string, pgPoolMax?: number }} config Runtime configuration.
 * @returns {import("pg").PoolConfig} Pool options.
 */
export function getPoolOptions(config) {
  return {
    connectionString: config.databaseUrl,
    max: config.pgPoolMax ?? 10,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS
  };
}

export function createPool() {
  const config = getConfig();

  if (!config.databaseUrl) {
    return null;
  }

  return new Pool(getPoolOptions(config));
}

export function getPool() {
  if (!pool) {
    pool = createPool();
  }

  return pool;
}

/**
 * Runs `fn` inside a transaction on a dedicated client.
 *
 * Commits when `fn` resolves, rolls back and rethrows when it fails, and always releases the
 * client. Use the client passed to `fn` for every statement of the transaction.
 *
 * @template T
 * @param {import("pg").Pool} pool Database pool.
 * @param {(client: import("pg").PoolClient) => Promise<T>} fn Transaction body.
 * @returns {Promise<T>} Result of `fn`.
 */
export async function withTransaction(pool, fn) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The original error is more useful than a failed rollback on a broken connection.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
}
