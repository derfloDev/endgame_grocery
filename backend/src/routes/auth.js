import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { getPool } from "../db/client.js";
import { getConfig } from "../env.js";
import createMailer from "../mail/mailer.js";

function createToken({ jwtLib, config, userId }) {
  return jwtLib.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
}

export function createAuthRouter({
  pool = getPool(),
  bcryptLib = bcrypt,
  jwtLib = jwt,
  config = getConfig(),
  mailer = createMailer({ config }),
  generateVerificationToken = randomUUID,
  now = () => new Date()
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
          INSERT INTO users (email, password_hash, display_name, email_verified)
          VALUES ($1, $2, $3, $4)
          RETURNING id, email, display_name, created_at
        `,
        [email.toLowerCase(), passwordHash, displayName, false]
      );
      const verificationToken = generateVerificationToken();
      const expiresAt = addHours(now(), 24);

      await pool.query(
        `
          INSERT INTO email_verification_tokens (user_id, token, expires_at)
          VALUES ($1, $2, $3)
          RETURNING token
        `,
        [result.rows[0].id, verificationToken, expiresAt]
      );

      await sendVerificationEmail({
        config,
        mailer,
        token: verificationToken,
        user: result.rows[0]
      });

      res.status(201).json({ message: "Verification email sent." });
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
          SELECT id, email, display_name, password_hash, email_verified
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

      if (!user.email_verified) {
        res.status(403).json({ error: "Please verify your email before logging in." });
        return;
      }

      res.json({
        token: createToken({ jwtLib, config, userId: user.id })
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/verify-email", async (req, res, next) => {
    const verificationToken = req.query.token;

    if (!verificationToken) {
      res.status(400).json({ error: "Verification token is required." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const result = await pool.query(
        `
          SELECT evt.user_id, u.email, u.display_name
          FROM email_verification_tokens evt
          JOIN users u ON u.id = evt.user_id
          WHERE evt.token = $1
            AND evt.expires_at > $2
          LIMIT 1
        `,
        [verificationToken, now()]
      );
      const verification = result.rows[0];

      if (!verification) {
        res.status(400).json({ error: "Verification link is invalid or has expired." });
        return;
      }

      await pool.query(
        `
          UPDATE users
          SET email_verified = true
          WHERE id = $1
        `,
        [verification.user_id]
      );
      await pool.query(
        `
          DELETE FROM email_verification_tokens
          WHERE token = $1
        `,
        [verificationToken]
      );

      res.json({
        token: createToken({ jwtLib, config, userId: verification.user_id })
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/resend-verification", async (req, res, next) => {
    const { email } = req.body ?? {};

    if (!email) {
      res.status(400).json({ error: "Email is required." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const result = await pool.query(
        `
          SELECT id, email, display_name, email_verified
          FROM users
          WHERE email = $1
          LIMIT 1
        `,
        [email.toLowerCase()]
      );
      const user = result.rows[0];

      if (user && !user.email_verified) {
        const verificationToken = generateVerificationToken();
        const expiresAt = addHours(now(), 24);

        await pool.query(
          `
            DELETE FROM email_verification_tokens
            WHERE user_id = $1
          `,
          [user.id]
        );
        await pool.query(
          `
            INSERT INTO email_verification_tokens (user_id, token, expires_at)
            VALUES ($1, $2, $3)
            RETURNING token
          `,
          [user.id, verificationToken, expiresAt]
        );

        await sendVerificationEmail({
          config,
          mailer,
          token: verificationToken,
          user
        });
      }

      res.json({ message: "If your account is pending verification, a new email has been sent." });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function buildAppUrl(baseUrl, path) {
  const normalizedBaseUrl = baseUrl?.replace(/\/$/, "") ?? "";

  return normalizedBaseUrl ? `${normalizedBaseUrl}${path}` : path;
}

async function sendVerificationEmail({ config, mailer, token, user }) {
  await mailer.send({
    to: user.email,
    subject: "Bitte bestätige deine E-Mail-Adresse",
    template: "verification",
    context: {
      heading: "Willkommen bei Endgame Grocery",
      intro: `Hi ${user.display_name},`,
      body: "Bitte bestätige deine E-Mail-Adresse, damit du deine Einkaufslisten nutzen kannst.",
      ctaLabel: "E-Mail bestätigen",
      ctaUrl: buildAppUrl(
        config.appBaseUrl,
        `/verify-email?token=${encodeURIComponent(token)}`
      )
    }
  });
}

export default createAuthRouter;
