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

export const requireAuth = createRequireAuth();
