import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { generateToken, getApiKeyHint, hashToken } from "../tokens.js";
import { Router } from "express";
import { getPool, withTransaction } from "../db/client.js";
import { getConfig } from "../env.js";
import { acceptInviteForUser, getPendingInviteByToken } from "../inviteService.js";
import { logger as defaultLogger } from "../logger.js";
import createMailer, { sendMailInBackground } from "../mail/mailer.js";
import { createRequireAuth } from "../middleware/auth.js";
import { createRateLimiters } from "../middleware/rateLimit.js";
import { checkPassword } from "../passwordPolicy.js";
import { sseManager as defaultSseManager } from "../sseManager.js";
import { ApiError } from "../errors.js";

// A valid cost-12 bcrypt hash of a throwaway password. Login compares against it when the email
// is unknown so that the unknown-user path takes as long as a wrong-password check.
const DUMMY_PASSWORD_HASH = "$2b$12$9D2Gq/c6ojGzJTRaJQ9Fh.MvGU9zq/NrLY8IGwzs1jy0zxVyzkTUq";

/**
 * Creates a signed JWT for an authenticated user.
 *
 * @param {{ jwtLib: typeof jwt, config: { jwtSecret: string, jwtExpiresIn: string }, userId: string, tokenVersion?: number }} options Token options.
 * @returns {string} Signed JWT.
 */
function createToken({ jwtLib, config, userId, tokenVersion = 0 }) {
  // `tv` ties the token to the user's token_version; a password reset bumps it and thereby
  // revokes every token issued before.
  return jwtLib.sign({ sub: userId, tv: tokenVersion }, config.jwtSecret, {
    algorithm: "HS256",
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
  generateVerificationToken = generateToken,
  generatePasswordResetToken = generateToken,
  generateApiKey = generateToken,
  now = () => new Date(),
  rateLimiters = createRateLimiters(),
  requireAuthMiddleware = createRequireAuth({ jwtLib, config, pool })
} = {}) {
  const router = Router();
  const requireAuth = requireAuthMiddleware;

  router.post("/register", ...rateLimiters.register, async (req, res, next) => {
    if (config.registrationEnabled === false) {
      next(new ApiError(404, "auth.registration_disabled", "Registration is disabled."));
      return;
    }

    const { email, password, display_name: displayName, invite_token: inviteToken } = req.body ?? {};

    if (!email || !password || !displayName) {
      next(new ApiError(400, "validation.registration_fields_required", "Email, password, and display_name are required."));
      return;
    }

    const passwordError = checkPassword(password);

    if (passwordError) {
      next(new ApiError(400, passwordError.code, passwordError.message));
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

      // User, invite claim/membership and verification token are committed together: a failure
      // can no longer leave an account without its token (which would lock the user out).
      const { user, acceptedInvite, verificationToken } = await withTransaction(pool, async (client) => {
        const inserted = await client.query(
          `
            INSERT INTO users (email, password_hash, display_name, email_verified)
            VALUES ($1, $2, $3, $4)
            RETURNING id, email, display_name, created_at
          `,
          [normalizedEmail, passwordHash, displayName, Boolean(pendingInvite)]
        );
        const createdUser = inserted.rows[0];
        const accepted = pendingInvite
          ? await acceptInviteForUser({
              pool,
              client,
              invite: pendingInvite,
              userId: createdUser.id,
              now: now()
            })
          : null;

        if (accepted) {
          return { user: createdUser, acceptedInvite: accepted, verificationToken: null };
        }

        if (pendingInvite) {
          // The invite was used by someone else between the lookup and the insert, so the account
          // was not vetted by it after all: fall back to the normal email verification.
          await client.query("UPDATE users SET email_verified = false WHERE id = $1", [createdUser.id]);
        }

        // Only the hash is stored; the plaintext leaves the server in the verification mail.
        const token = generateVerificationToken();
        await client.query(
          `
            INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
            VALUES ($1, $2, $3)
          `,
          [createdUser.id, hashToken(token), addHours(now(), 24)]
        );

        return { user: createdUser, acceptedInvite: null, verificationToken: token };
      });
      const result = { rows: [user] };

      if (acceptedInvite) {
        const { listId, memberAdded } = acceptedInvite;

        if (memberAdded) {
          void sseManager
            .broadcastToList(pool, listId, "member:added", {
              listId,
              userId: user.id
            })
            .catch((broadcastError) => {
              logger.error({ err: broadcastError }, "Failed to broadcast SSE event");
            });
        }

        logger.info(
          {
            userId: user.id,
            email: normalizedEmail,
            inviteUsed: true
          },
          "User registered"
        );
        res.status(201).json({
          token: createToken({ jwtLib, config, userId: user.id }),
          listId,
          user: serializeAuthUser(user)
        });
        return;
      }

      sendMailInBackground(
        () =>
          sendVerificationEmail({
            config,
            mailer,
            token: verificationToken,
            user
          }),
        logger
      );

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
        next(new ApiError(409, "auth.email_taken", "An account with that email already exists."));
        return;
      }

      next(error);
    }
  });

  router.post("/login", ...rateLimiters.login, async (req, res, next) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      next(new ApiError(400, "validation.credentials_required", "Email and password are required."));
      return;
    }

    try {
      const normalizedEmail = email.toLowerCase();
      const result = await pool.query(
        `
          SELECT id, email, display_name, password_hash, email_verified, token_version
          FROM users
          WHERE email = $1
          LIMIT 1
        `,
        [normalizedEmail]
      );

      const user = result.rows[0];

      if (!user) {
        // Hash-compare anyway so unknown accounts cost as much time as wrong passwords and the
        // response time does not reveal which emails are registered.
        await bcryptLib.compare(password, DUMMY_PASSWORD_HASH);
        logger.warn({ email: normalizedEmail, reason: "invalid_credentials" }, "Login failed");
        next(new ApiError(401, "auth.invalid_credentials", "Invalid email or password."));
        return;
      }

      const isValid = await bcryptLib.compare(password, user.password_hash);

      if (!isValid) {
        logger.warn({ email: normalizedEmail, reason: "invalid_credentials" }, "Login failed");
        next(new ApiError(401, "auth.invalid_credentials", "Invalid email or password."));
        return;
      }

      if (!user.email_verified) {
        logger.warn({ email: normalizedEmail, reason: "email_not_verified" }, "Login blocked");
        next(new ApiError(403, "auth.email_not_verified", "Please verify your email before logging in."));
        return;
      }

      logger.info({ userId: user.id }, "User logged in");
      res.json({
        token: createToken({ jwtLib, config, userId: user.id, tokenVersion: user.token_version }),
        user: serializeAuthUser(user)
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/verify-email", async (req, res, next) => {
    const verificationToken = req.query.token;

    if (!verificationToken) {
      next(new ApiError(400, "validation.verification_token_required", "Verification token is required."));
      return;
    }

    try {
      const result = await pool.query(
        `
          SELECT evt.user_id, u.email, u.display_name, u.token_version
          FROM email_verification_tokens evt
          JOIN users u ON u.id = evt.user_id
          WHERE evt.token_hash = $1
            AND evt.expires_at > $2
          LIMIT 1
        `,
        [hashToken(verificationToken), now()]
      );
      const verification = result.rows[0];

      if (!verification) {
        next(new ApiError(400, "auth.verification_invalid", "Verification link is invalid or has expired."));
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
          WHERE token_hash = $1
        `,
        [hashToken(verificationToken)]
      );

      logger.info({ userId: verification.user_id }, "Email verified");
      res.json({
        token: createToken({
          jwtLib,
          config,
          userId: verification.user_id,
          tokenVersion: verification.token_version
        }),
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

  router.post("/resend-verification", ...rateLimiters.resendVerification, async (req, res, next) => {
    const { email } = req.body ?? {};

    if (!email) {
      next(new ApiError(400, "validation.email_required", "Email is required."));
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

        // Replace the old token atomically so a failure cannot leave the user without one.
        await withTransaction(pool, async (client) => {
          await client.query(
            `
              DELETE FROM email_verification_tokens
              WHERE user_id = $1
            `,
            [user.id]
          );
          await client.query(
            `
              INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
              VALUES ($1, $2, $3)
            `,
            [user.id, hashToken(verificationToken), expiresAt]
          );
        });

        sendMailInBackground(
          () =>
            sendVerificationEmail({
              config,
              mailer,
              token: verificationToken,
              user
            }),
          logger
        );
      }

      res.json({ message: "If your account is pending verification, a new email has been sent." });
    } catch (error) {
      next(error);
    }
  });

  router.post("/forgot-password", ...rateLimiters.forgotPassword, async (req, res, next) => {
    const { email } = req.body ?? {};

    if (!email) {
      next(new ApiError(400, "validation.email_required", "Email is required."));
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
            INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
            VALUES ($1, $2, $3)
          `,
          [user.id, hashToken(resetToken), expiresAt]
        );

        // Answered the same whether or not the account exists, so a mail failure must not show.
        sendMailInBackground(
          () =>
            sendPasswordResetEmail({
              config,
              mailer,
              token: resetToken,
              user
            }),
          logger
        );
      }

      res.json({ message: "If an account exists, you will receive an email." });
    } catch (error) {
      next(error);
    }
  });

  router.post("/reset-password", ...rateLimiters.resetPassword, async (req, res, next) => {
    const { token, password } = req.body ?? {};

    if (!token || !password) {
      next(new ApiError(400, "validation.token_password_required", "Token and password are required."));
      return;
    }

    const passwordError = checkPassword(password);

    if (passwordError) {
      next(new ApiError(400, passwordError.code, passwordError.message));
      return;
    }

    try {
      const userId = await withTransaction(pool, async (client) => {
        // Claiming the token is the only check: two concurrent requests with the same token
        // serialise on this row, and the loser re-evaluates `used = false` and gets no row.
        const claim = await client.query(
          `
            UPDATE password_reset_tokens
            SET used = true
            WHERE token_hash = $1
              AND used = false
              AND expires_at > $2
            RETURNING user_id
          `,
          [hashToken(token), now()]
        );
        const resetRequest = claim.rows[0];

        if (!resetRequest) {
          return null;
        }

        const passwordHash = await bcryptLib.hash(password, 12);

        // Bumping token_version signs the user out everywhere; the API key is cleared because
        // whoever knew the old password may also have read the key (Home Assistant needs a new one).
        await client.query(
          `
            UPDATE users
            SET password_hash = $1,
                token_version = token_version + 1,
                api_key_hash = NULL,
                api_key_hint = NULL,
                api_key_created_at = NULL
            WHERE id = $2
          `,
          [passwordHash, resetRequest.user_id]
        );
        await client.query(
          `
            DELETE FROM password_reset_tokens
            WHERE user_id = $1
              AND token_hash <> $2
          `,
          [resetRequest.user_id, hashToken(token)]
        );

        return resetRequest.user_id;
      });

      if (!userId) {
        next(new ApiError(400, "auth.reset_invalid", "Password reset link is invalid or has expired."));
        return;
      }

      logger.info({ userId }, "Password reset completed");
      res.json({ message: "Password updated." });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", requireAuth, async (req, res, next) => {
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
        next(new ApiError(404, "user.not_found", "User not found."));
        return;
      }

      res.json(serializeAuthUser(user));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api-key", requireAuth, async (req, res, next) => {
    try {
      // The key itself is not stored (only its hash), so it can no longer be read back.
      const result = await pool.query(
        `
          SELECT api_key_hash, api_key_hint, api_key_created_at
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [req.user.sub]
      );
      const user = result.rows[0];

      if (!user) {
        next(new ApiError(404, "user.not_found", "User not found."));
        return;
      }

      res.json({
        has_key: Boolean(user.api_key_hash),
        hint: user.api_key_hint ?? null,
        created_at: user.api_key_created_at ?? null
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api-key", requireAuth, async (req, res, next) => {
    try {
      const apiKey = generateApiKey();
      const result = await pool.query(
        `
          UPDATE users
          SET api_key_hash = $1,
              api_key_hint = $2,
              api_key_created_at = $3
          WHERE id = $4
          RETURNING api_key_hint, api_key_created_at
        `,
        [hashToken(apiKey), getApiKeyHint(apiKey), now(), req.user.sub]
      );
      const user = result.rows[0];

      if (!user) {
        next(new ApiError(404, "user.not_found", "User not found."));
        return;
      }

      // The only time the plaintext key is returned; afterwards just the hint is available.
      res.json({
        api_key: apiKey,
        hint: user.api_key_hint,
        created_at: user.api_key_created_at
      });
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
