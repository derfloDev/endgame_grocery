import jwt from "jsonwebtoken";
import { getConfig } from "../env.js";

export function createRequireAuth({ jwtLib = jwt, config = getConfig() } = {}) {
  return function requireAuth(req, res, next) {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentication token is required." });
      return;
    }

    const token = header.slice("Bearer ".length);

    try {
      req.user = jwtLib.verify(token, config.jwtSecret);
      next();
    } catch {
      res.status(401).json({ error: "Authentication token is invalid." });
    }
  };
}

export function createRequireAuthFn({ jwtLib = jwt, config = getConfig() } = {}) {
  return function requireAuthFn(token) {
    return jwtLib.verify(token, config.jwtSecret);
  };
}

export function createRequireApiKey({ pool } = {}) {
  return async function requireApiKey(req, res, next) {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      res.status(401).json({ error: "API key is required." });
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
          WHERE api_key = $1
          LIMIT 1
        `,
        [apiKey]
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
