import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Router } from "express";
import { getPool } from "../db/client.js";
import { getConfig } from "../env.js";

function createToken({ jwtLib, config, userId }) {
  return jwtLib.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
}

export function createAuthRouter({
  pool = getPool(),
  bcryptLib = bcrypt,
  jwtLib = jwt,
  config = getConfig()
} = {}) {
  const router = Router();

  router.post("/register", async (req, res, next) => {
    const { email, password, display_name: displayName } = req.body ?? {};

    if (!email || !password || !displayName) {
      res.status(400).json({ error: "Email, password, and display_name are required." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const passwordHash = await bcryptLib.hash(password, 12);

      const result = await pool.query(
        `
          INSERT INTO users (email, password_hash, display_name)
          VALUES ($1, $2, $3)
          RETURNING id, email, display_name, created_at
        `,
        [email.toLowerCase(), passwordHash, displayName]
      );

      res.status(201).json({
        user: {
          id: result.rows[0].id,
          email: result.rows[0].email,
          display_name: result.rows[0].display_name,
          created_at: result.rows[0].created_at
        }
      });
    } catch (error) {
      if (error.code === "23505") {
        res.status(409).json({ error: "An account with that email already exists." });
        return;
      }

      next(error);
    }
  });

  router.post("/login", async (req, res, next) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const result = await pool.query(
        `
          SELECT id, email, display_name, password_hash
          FROM users
          WHERE email = $1
          LIMIT 1
        `,
        [email.toLowerCase()]
      );

      const user = result.rows[0];

      if (!user) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }

      const isValid = await bcryptLib.compare(password, user.password_hash);

      if (!isValid) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }

      res.json({
        token: createToken({ jwtLib, config, userId: user.id })
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createAuthRouter;
