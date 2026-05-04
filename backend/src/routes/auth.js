import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { getPool } from "../db/client.js";
import { getConfig } from "../env.js";
import { acceptInviteForUser, getPendingInviteByToken } from "../inviteService.js";
import { logger as defaultLogger } from "../logger.js";
import createMailer from "../mail/mailer.js";
import { createRequireAuth } from "../middleware/auth.js";
import { sseManager as defaultSseManager } from "../sseManager.js";

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
  logger = defaultLogger,
  sseManager = defaultSseManager,
  mailer = createMailer({ config, logger }),
  generateVerificationToken = randomUUID,
  generatePasswordResetToken = randomUUID,
  now = () => new Date()
} = {}) {
  const router = Router();
  const requireAuth = createRequireAuth({ jwtLib, config });

  router.post("/register", async (req, res, next) => {
    if (config.registrationEnabled === false) {
      res.status(404).end();
      return;
    }

    const { email, password, display_name: displayName, invite_token: inviteToken } = req.body ?? {};

    if (!email || !password || !displayName) {
      res.status(400).json({ error: "Email, password, and display_name are required." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const normalizedEmail = email.toLowerCase();
      const passwordHash = await bcryptLib.hash(password, 12);
      const inviteCandidate = inviteToken
        ? await getPendingInviteByToken(pool, inviteToken, now())
        : null;
      const pendingInvite = isInviteEmailMatch(normalizedEmail, inviteCandidate)
        ? inviteCandidate
        : null;

      const result = await pool.query(
        `
          INSERT INTO users (email, password_hash, display_name, email_verified)
          VALUES ($1, $2, $3, $4)
          RETURNING id, email, display_name, created_at
        `,
        [normalizedEmail, passwordHash, displayName, Boolean(pendingInvite)]
      );

      if (pendingInvite) {
        const { listId, memberAdded } = await acceptInviteForUser({
          pool,
          invite: pendingInvite,
          userId: result.rows[0].id
        });

        if (memberAdded) {
          void sseManager
            .broadcastToList(pool, listId, "member:added", {
              listId,
              userId: result.rows[0].id
            })
            .catch((broadcastError) => {
              logger.error({ err: broadcastError }, "Failed to broadcast SSE event");
            });
        }

        logger.info(
          {
            userId: result.rows[0].id,
            email: normalizedEmail,
            inviteUsed: true
          },
          "User registered"
        );
        res.status(201).json({
          token: createToken({ jwtLib, config, userId: result.rows[0].id }),
          listId,
          user: serializeAuthUser(result.rows[0])
        });
        return;
      }

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

      logger.info(
        {
          userId: result.rows[0].id,
          email: normalizedEmail,
          inviteUsed: false
        },
        "User registered"
      );
      res.status(201).json({ message: "Verification email sent." });
    } catch (error) {
      if (error.code === "23505") {
        logger.warn(
          { email: email.toLowerCase() },
          "Registration rejected: email already exists"
        );
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
      const normalizedEmail = email.toLowerCase();
      const result = await pool.query(
        `
          SELECT id, email, display_name, password_hash, email_verified
          FROM users
          WHERE email = $1
          LIMIT 1
        `,
        [normalizedEmail]
      );

      const user = result.rows[0];

      if (!user) {
        logger.warn({ email: normalizedEmail, reason: "invalid_credentials" }, "Login failed");
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }

      const isValid = await bcryptLib.compare(password, user.password_hash);

      if (!isValid) {
        logger.warn({ email: normalizedEmail, reason: "invalid_credentials" }, "Login failed");
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }

      if (!user.email_verified) {
        logger.warn({ email: normalizedEmail, reason: "email_not_verified" }, "Login blocked");
        res.status(403).json({ error: "Please verify your email before logging in." });
        return;
      }

      logger.info({ userId: user.id }, "User logged in");
      res.json({
        token: createToken({ jwtLib, config, userId: user.id }),
        user: serializeAuthUser(user)
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

      logger.info({ userId: verification.user_id }, "Email verified");
      res.json({
        token: createToken({ jwtLib, config, userId: verification.user_id }),
        user: serializeAuthUser({
          id: verification.user_id,
          email: verification.email,
          display_name: verification.display_name
        })
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

  router.post("/forgot-password", async (req, res, next) => {
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

      if (user?.email_verified) {
        const resetToken = generatePasswordResetToken();
        const expiresAt = addHours(now(), 1);

        await pool.query(
          `
            INSERT INTO password_reset_tokens (user_id, token, expires_at)
            VALUES ($1, $2, $3)
            RETURNING token
          `,
          [user.id, resetToken, expiresAt]
        );

        await sendPasswordResetEmail({
          config,
          mailer,
          token: resetToken,
          user
        });
      }

      res.json({ message: "If an account exists, you will receive an email." });
    } catch (error) {
      next(error);
    }
  });

  router.post("/reset-password", async (req, res, next) => {
    const { token, password } = req.body ?? {};

    if (!token || !password) {
      res.status(400).json({ error: "Token and password are required." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const result = await pool.query(
        `
          SELECT prt.user_id
          FROM password_reset_tokens prt
          WHERE prt.token = $1
            AND prt.expires_at > $2
            AND prt.used = false
          LIMIT 1
        `,
        [token, now()]
      );
      const resetRequest = result.rows[0];

      if (!resetRequest) {
        res.status(400).json({ error: "Password reset link is invalid or has expired." });
        return;
      }

      const passwordHash = await bcryptLib.hash(password, 12);

      await pool.query(
        `
          UPDATE users
          SET password_hash = $1
          WHERE id = $2
        `,
        [passwordHash, resetRequest.user_id]
      );
      await pool.query(
        `
          UPDATE password_reset_tokens
          SET used = true
          WHERE token = $1
        `,
        [token]
      );

      logger.info({ userId: resetRequest.user_id }, "Password reset completed");
      res.json({ message: "Password updated." });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", requireAuth, async (req, res, next) => {
    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const result = await pool.query(
        `
          SELECT id, email, display_name
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [req.user.sub]
      );
      const user = result.rows[0];

      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      res.json(serializeAuthUser(user));
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

function isInviteEmailMatch(email, invite) {
  return Boolean(invite) && invite.invited_email?.toLowerCase() === email.toLowerCase();
}

function serializeAuthUser(user) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name
  };
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

async function sendPasswordResetEmail({ config, mailer, token, user }) {
  await mailer.send({
    to: user.email,
    subject: "Passwort zurücksetzen",
    template: "password-reset",
    context: {
      heading: "Passwort zurücksetzen",
      intro: `Hi ${user.display_name},`,
      body: "Nutze den Link unten, um dein Passwort zurückzusetzen. Der Link läuft in 60 Minuten ab.",
      ctaLabel: "Passwort zurücksetzen",
      ctaUrl: buildAppUrl(
        config.appBaseUrl,
        `/reset-password?token=${encodeURIComponent(token)}`
      )
    }
  });
}

export default createAuthRouter;
