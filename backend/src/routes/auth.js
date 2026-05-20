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

/**
 * Creates a signed JWT for an authenticated user.
 *
 * @param {{ jwtLib: typeof jwt, config: { jwtSecret: string, jwtExpiresIn: string }, userId: string }} options Token options.
 * @returns {string} Signed JWT.
 */
function createToken({ jwtLib, config, userId }) {
  return jwtLib.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
}

/**
 * Creates the authentication router.
 *
 * @param {object} [options] Router dependencies.
 * @param {import("pg").Pool} [options.pool] Database pool.
 * @param {typeof bcrypt} [options.bcryptLib] Password hashing library.
 * @param {typeof jwt} [options.jwtLib] JWT library.
 * @param {ReturnType<typeof getConfig>} [options.config] Runtime configuration.
 * @param {typeof defaultLogger} [options.logger] Application logger.
 * @param {typeof defaultSseManager} [options.sseManager] SSE broadcaster.
 * @param {ReturnType<typeof createMailer>} [options.mailer] Mail delivery adapter.
 * @param {() => string} [options.generateVerificationToken] Verification token generator.
 * @param {() => string} [options.generatePasswordResetToken] Password reset token generator.
 * @param {() => string} [options.generateApiKey] API key generator.
 * @param {() => Date} [options.now] Current-time provider.
 * @returns {import("express").Router} Configured auth router.
 */
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
  generateApiKey = randomUUID,
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

  router.get("/api-key", requireAuth, async (req, res, next) => {
    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const result = await pool.query(
        `
          SELECT api_key
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

      res.json({ api_key: user.api_key });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api-key", requireAuth, async (req, res, next) => {
    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const apiKey = generateApiKey();
      const result = await pool.query(
        `
          UPDATE users
          SET api_key = $1
          WHERE id = $2
          RETURNING api_key
        `,
        [apiKey, req.user.sub]
      );
      const user = result.rows[0];

      if (!user) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      res.json({ api_key: user.api_key });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/**
 * Adds hours to a date.
 *
 * @param {Date} date Base date.
 * @param {number} hours Hours to add.
 * @returns {Date} Shifted date.
 */
function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Builds an application URL from the configured base URL and path.
 *
 * @param {string} baseUrl Application base URL.
 * @param {string} path Absolute application path.
 * @returns {string} Full application URL or path when no base URL is configured.
 */
function buildAppUrl(baseUrl, path) {
  const normalizedBaseUrl = baseUrl?.replace(/\/$/, "") ?? "";

  return normalizedBaseUrl ? `${normalizedBaseUrl}${path}` : path;
}

/**
 * Checks whether an invite belongs to the registering email address.
 *
 * @param {string} email Normalized candidate email address.
 * @param {{ invited_email?: string } | null} invite Pending invite row.
 * @returns {boolean} Whether the invite email matches.
 */
function isInviteEmailMatch(email, invite) {
  return Boolean(invite) && invite.invited_email?.toLowerCase() === email.toLowerCase();
}

/**
 * Serializes a database user row for auth responses.
 *
 * @param {{ id: string, email: string, display_name: string }} user User row.
 * @returns {{ id: string, email: string, display_name: string }} Public auth user.
 */
function serializeAuthUser(user) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name
  };
}

/**
 * Sends an email verification message.
 *
 * @param {object} options Email options.
 * @param {ReturnType<typeof getConfig>} options.config Runtime configuration.
 * @param {ReturnType<typeof createMailer>} options.mailer Mail delivery adapter.
 * @param {string} options.token Verification token.
 * @param {{ email: string, display_name: string }} options.user User row.
 * @returns {Promise<void>} Resolves when the mailer accepts the message.
 */
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

/**
 * Sends a password reset message.
 *
 * @param {object} options Email options.
 * @param {ReturnType<typeof getConfig>} options.config Runtime configuration.
 * @param {ReturnType<typeof createMailer>} options.mailer Mail delivery adapter.
 * @param {string} options.token Password reset token.
 * @param {{ email: string, display_name: string }} options.user User row.
 * @returns {Promise<void>} Resolves when the mailer accepts the message.
 */
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
