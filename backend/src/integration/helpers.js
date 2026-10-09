import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe } from "node:test";
import jwt from "jsonwebtoken";
import { runner } from "node-pg-migrate";
import pg from "pg";
import { generateToken, hashToken } from "../tokens.js";

/**
 * Shared harness for integration tests that run against a real PostgreSQL server.
 *
 * Every test file gets its own schema, so files can run in parallel against one database. The
 * tests are skipped when `TEST_DATABASE_URL` is not set (for example on a developer machine
 * without PostgreSQL); CI always sets it.
 */

const { Client, Pool } = pg;

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../db/migrations"
);
const MIGRATIONS_TABLE = "pgmigrations";
// Arbitrary advisory-lock id that serialises extension setup between parallel test files.
const SETUP_LOCK_ID = 7241865325823965;
// Extensions that migrations create. They live in `public` so that dropping one test schema
// never drops an extension that other test files still use.
const SHARED_EXTENSIONS = ["pgcrypto"];

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const TEST_JWT_SECRET = "integration-test-secret-0123456789abcdef0123456789";

/**
 * `describe` that runs only when `TEST_DATABASE_URL` is set and otherwise reports a skip reason.
 *
 * @param {string} name Suite name.
 * @param {() => void} fn Suite body.
 * @returns {unknown} The node:test suite.
 */
export function describeDb(name, fn) {
  if (!TEST_DATABASE_URL) {
    return describe(name, { skip: "TEST_DATABASE_URL is not set" }, () => {});
  }

  return describe(name, fn);
}

async function ensureSharedExtensions(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [SETUP_LOCK_ID]);

    try {
      for (const extension of SHARED_EXTENSIONS) {
        await client.query(`CREATE EXTENSION IF NOT EXISTS ${extension} SCHEMA public`);
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [SETUP_LOCK_ID]);
    }
  } finally {
    await client.end();
  }
}

/**
 * Creates an isolated schema, migrates it to the latest version and returns a pool bound to it.
 *
 * @returns {Promise<{
 *   pool: import("pg").Pool,
 *   schema: string,
 *   migrate: (direction: "up" | "down", count?: number) => Promise<void>,
 *   snapshot: () => Promise<{ columns: unknown[], indexes: unknown[], constraints: unknown[] }>,
 *   close: () => Promise<void>
 * }>} Test database handle.
 */
export async function createTestDatabase() {
  if (!TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL is not set.");
  }

  await ensureSharedExtensions(TEST_DATABASE_URL);

  const schema = `it_${randomBytes(6).toString("hex")}`;
  const admin = new Pool({ connectionString: TEST_DATABASE_URL, max: 1 });
  await admin.query(`CREATE SCHEMA "${schema}"`);

  const pool = new Pool({
    connectionString: TEST_DATABASE_URL,
    max: 5,
    options: `-c search_path=${schema},public`
  });

  async function migrate(direction, count = Infinity) {
    const client = new Client({
      connectionString: TEST_DATABASE_URL,
      options: `-c search_path=${schema},public`
    });
    await client.connect();

    try {
      await runner({
        dbClient: client,
        dir: MIGRATIONS_DIR,
        direction,
        // Apply or revert every migration unless a count is given.
        count,
        migrationsTable: MIGRATIONS_TABLE,
        schema,
        // Schemas are isolated per test file, so the global migration lock is unnecessary.
        noLock: true,
        log: () => {}
      });
    } finally {
      await client.end();
    }
  }

  /** Normalises a catalog definition so snapshots do not depend on the random schema name. */
  const normalise = (value) => String(value).replaceAll(`${schema}.`, "").replaceAll(`"${schema}".`, "");

  async function snapshot() {
    const columns = await pool.query(
      `
        SELECT table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name <> $2
        ORDER BY table_name, column_name
      `,
      [schema, MIGRATIONS_TABLE]
    );
    const indexes = await pool.query(
      `
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = $1 AND tablename <> $2
        ORDER BY tablename, indexname
      `,
      [schema, MIGRATIONS_TABLE]
    );
    const constraints = await pool.query(
      `
        SELECT c.relname AS table_name, k.conname, k.contype, pg_get_constraintdef(k.oid) AS definition
        FROM pg_constraint k
        JOIN pg_class c ON c.oid = k.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname <> $2
        ORDER BY c.relname, k.conname
      `,
      [schema, MIGRATIONS_TABLE]
    );

    return {
      columns: columns.rows.map((row) => ({ ...row, column_default: normalise(row.column_default) })),
      indexes: indexes.rows.map((row) => ({ ...row, indexdef: normalise(row.indexdef) })),
      constraints: constraints.rows.map((row) => ({ ...row, definition: normalise(row.definition) }))
    };
  }

  async function close() {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }

  try {
    await migrate("up");
  } catch (error) {
    await close();
    throw error;
  }

  return { pool, schema, migrate, snapshot, close };
}

/**
 * Inserts a user.
 *
 * @param {import("pg").Pool} pool Database pool.
 * @param {{ email?: string, displayName?: string, verified?: boolean }} [options] User fields.
 * @returns {Promise<{ id: string, email: string }>} Created user.
 */
export async function createUser(pool, { email, displayName = "Test User", verified = true } = {}) {
  const result = await pool.query(
    `
      INSERT INTO users (email, password_hash, display_name, email_verified)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email
    `,
    [(email ?? `user-${randomUUID()}@example.test`).toLowerCase(), "not-a-real-hash", displayName, verified]
  );

  return result.rows[0];
}

/**
 * Inserts a list.
 *
 * @param {import("pg").Pool} pool Database pool.
 * @param {{ ownerId: string, name?: string }} options List fields.
 * @returns {Promise<{ id: string, name: string, owner_id: string }>} Created list.
 */
export async function createList(pool, { ownerId, name = "Groceries" }) {
  const result = await pool.query(
    "INSERT INTO lists (name, owner_id) VALUES ($1, $2) RETURNING id, name, owner_id",
    [name, ownerId]
  );

  return result.rows[0];
}

/**
 * Adds a user as list member.
 *
 * @param {import("pg").Pool} pool Database pool.
 * @param {{ listId: string, userId: string }} options Membership fields.
 * @returns {Promise<void>}
 */
export async function addMember(pool, { listId, userId }) {
  await pool.query("INSERT INTO list_members (list_id, user_id) VALUES ($1, $2)", [listId, userId]);
}

/**
 * Inserts an entry.
 *
 * @param {import("pg").Pool} pool Database pool.
 * @param {{ listId: string, text?: string, status?: "open" | "done", lastUpdatedBy?: string | null }} options Entry fields.
 * @returns {Promise<{ id: string, list_id: string, text: string, status: string }>} Created entry.
 */
export async function createEntry(pool, { listId, text = "Milk", status = "open", lastUpdatedBy = null }) {
  const result = await pool.query(
    `
      INSERT INTO entries (list_id, text, status, last_updated_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id, list_id, text, status
    `,
    [listId, text, status, lastUpdatedBy]
  );

  return result.rows[0];
}

/**
 * Inserts a pending list invite.
 *
 * @param {import("pg").Pool} pool Database pool.
 * @param {{ listId: string, invitedEmail: string, invitedBy: string, expiresAt?: Date }} options Invite fields.
 * @returns {Promise<{ id: string, token: string }>} Created invite; `token` is the plaintext value
 *   (only its hash is stored).
 */
export async function createInvite(
  pool,
  { listId, invitedEmail, invitedBy, expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
) {
  const token = generateToken();
  const result = await pool.query(
    `
      INSERT INTO list_invites (list_id, invited_email, invited_by, token_hash, expires_at)
      VALUES ($1, LOWER($2), $3, $4, $5)
      RETURNING id
    `,
    [listId, invitedEmail, invitedBy, hashToken(token), expiresAt]
  );

  return { id: result.rows[0].id, token };
}

/**
 * Signs a JWT the same way the login route does.
 *
 * @param {string} userId User identifier.
 * @param {number} [tokenVersion] Value of the `tv` claim; omit it to sign a token like the ones
 *   issued before token versions existed.
 * @returns {string} Signed token.
 */
export function signTestToken(userId, tokenVersion) {
  const payload = tokenVersion === undefined ? { sub: userId } : { sub: userId, tv: tokenVersion };

  return jwt.sign(payload, TEST_JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });
}
