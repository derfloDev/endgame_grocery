import jwt from "jsonwebtoken";
import { getConfig } from "../env.js";
import { hashToken } from "../tokens.js";
import { isUuid } from "./validateUuid.js";

// Pin the algorithm so tokens with alg "none" or another HMAC variant are never accepted.
export const JWT_ALGORITHM = "HS256";
const JWT_VERIFY_OPTIONS = { algorithms: [JWT_ALGORITHM] };

/**
 * Checks a verified token against the user's current `token_version`.
 *
 * Every JWT carries the version it was issued with in the `tv` claim (a token without the claim
 * counts as version 0). A password reset bumps the stored version, which revokes all tokens issued
 * before it. A user that no longer exists has no valid tokens either.
 *
 * @param {import("pg").Pool} pool Database pool.
 * @param {{ sub: string, tv?: number }} payload Verified JWT payload.
 * @returns {Promise<boolean>} Whether the token is still current.
 */
async function isTokenCurrent(pool, payload) {
  const result = await pool.query("SELECT token_version FROM users WHERE id = $1", [payload.sub]);
  const user = result.rows[0];

  return Boolean(user) && user.token_version === (payload.tv ?? 0);
}

/**
 * Creates an async verifier that returns the payload of a valid, non-revoked JWT or throws.
 *
 * Without a pool only signature, algorithm and expiry are checked; that only happens in tests,
 * because the server refuses to start without a database.
 *
 * @param {object} [options] Verifier dependencies.
 * @param {typeof jwt} [options.jwtLib] JWT library.
 * @param {{ jwtSecret: string }} [options.config] Runtime configuration.
 * @param {import("pg").Pool | null} [options.pool] Database pool for the token version lookup.
 * @returns {(token: string) => Promise<jwt.JwtPayload>} Token verifier.
 */
export function createRequireAuthFn({ jwtLib = jwt, config = getConfig(), pool } = {}) {
  return async function requireAuthFn(token) {
    const payload = jwtLib.verify(token, config.jwtSecret, JWT_VERIFY_OPTIONS);

    if (pool && !(await isTokenCurrent(pool, payload))) {
      throw new Error("Token has been revoked.");
    }

    return payload;
  };
}

/**
 * Creates the Express middleware that requires a valid Bearer token.
 *
 * @param {object} [options] Middleware dependencies, see {@link createRequireAuthFn}.
 * @returns {import("express").RequestHandler} Auth middleware.
 */
export function createRequireAuth({ jwtLib = jwt, config = getConfig(), pool } = {}) {
  return async function requireAuth(req, res, next) {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentication token is required." });
      return;
    }

    const token = header.slice("Bearer ".length);
    let payload;

    try {
      payload = jwtLib.verify(token, config.jwtSecret, JWT_VERIFY_OPTIONS);
    } catch {
      res.status(401).json({ error: "Authentication token is invalid." });
      return;
    }

    try {
      if (pool && !(await isTokenCurrent(pool, payload))) {
        res.status(401).json({ error: "Authentication token is invalid." });
        return;
      }
    } catch (error) {
      // A database failure is not an authentication result.
      next(error);
      return;
    }

    req.user = payload;
    next();
  };
}

export function createRequireApiKey({ pool } = {}) {
  return async function requireApiKey(req, res, next) {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      res.status(401).json({ error: "API key is required." });
      return;
    }

    // Keys are generated as UUIDs, so anything else cannot match and needs no query.
    if (!isUuid(apiKey)) {
      res.status(401).json({ error: "Invalid API key." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const result = await pool.query(
        `
          SELECT id
          FROM users
          WHERE api_key_hash = $1
          LIMIT 1
        `,
        [hashToken(apiKey)]
      );
      const user = result.rows[0];

      if (!user) {
        res.status(401).json({ error: "Invalid API key." });
        return;
      }

      req.user = { sub: user.id };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireAuth = createRequireAuth();
