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

export function createTestRouter({
  pool = getPool(),
  bcryptLib = bcrypt,
  jwtLib = jwt,
  config = getConfig()
} = {}) {
  const router = Router();

  router.post("/create-verified-user", async (req, res, next) => {
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
          INSERT INTO users (email, password_hash, display_name, email_verified)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [email.toLowerCase(), passwordHash, displayName, true]
      );

      res.status(201).json({
        token: createToken({
          jwtLib,
          config,
          userId: result.rows[0].id
        })
      });
    } catch (error) {
      if (error.code === "23505") {
        res.status(409).json({ error: "An account with that email already exists." });
        return;
      }

      next(error);
    }
  });

  return router;
}

export default createTestRouter;
