import rateLimit from "express-rate-limit";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Default limits. Counters live in memory, which matches the single-instance deployment.
 *
 * - `login` counts failed attempts only (successful logins are refunded), per IP and per email.
 * - `register`, `forgotPassword` and `resendVerification` send mail or create accounts, so every
 *   request counts, per IP and per email.
 * - `resetPassword` is keyed by IP only because the token, not the email, identifies the request.
 * - `invite` limits invitation mails per authenticated user.
 */
export const DEFAULT_RATE_LIMITS = {
  login: { limit: 5, windowMs: 15 * MINUTE_MS },
  register: { limit: 5, windowMs: HOUR_MS },
  forgotPassword: { limit: 5, windowMs: HOUR_MS },
  resendVerification: { limit: 5, windowMs: HOUR_MS },
  resetPassword: { limit: 10, windowMs: HOUR_MS },
  invite: { limit: 20, windowMs: HOUR_MS }
};

/**
 * Normalises the email of a request body so different spellings share one counter.
 *
 * @param {import("express").Request} req Request.
 * @returns {string} Lower-case email or an empty string.
 */
export function getEmailKey(req) {
  const email = req.body?.email;

  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function tooManyRequests(req, res) {
  const resetTime = req.rateLimit?.resetTime;
  const retryAfterSeconds = resetTime
    ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
    : 60;

  res.set("Retry-After", String(retryAfterSeconds));
  res.status(429).json({ error: "Too many requests. Please try again later." });
}

function createLimiter({ limit, windowMs }, extra = {}) {
  return rateLimit({
    limit,
    windowMs,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: tooManyRequests,
    ...extra
  });
}

/**
 * Creates the rate-limit middlewares for the abuse-prone endpoints.
 *
 * Each call builds fresh counters, so every app instance (and every test) starts from zero.
 *
 * @param {Partial<Record<keyof typeof DEFAULT_RATE_LIMITS, { limit?: number, windowMs?: number }>>} [overrides]
 *   Per-limiter overrides, mainly for tests.
 * @param {{ disabled?: boolean }} [options] `disabled` returns empty chains (E2E configuration only).
 * @returns {Record<keyof typeof DEFAULT_RATE_LIMITS, import("express").RequestHandler[]>} Middleware chains.
 */
export function createRateLimiters(overrides = {}, { disabled = false } = {}) {
  if (disabled) {
    return Object.fromEntries(Object.keys(DEFAULT_RATE_LIMITS).map((name) => [name, []]));
  }

  const settings = Object.fromEntries(
    Object.entries(DEFAULT_RATE_LIMITS).map(([name, defaults]) => [name, { ...defaults, ...overrides[name] }])
  );
  // Limits per email only apply when the request actually carries one.
  const emailLimiter = (config, extra = {}) =>
    createLimiter(config, {
      keyGenerator: getEmailKey,
      skip: (req) => !getEmailKey(req),
      ...extra
    });

  return {
    login: [
      createLimiter(settings.login, { skipSuccessfulRequests: true }),
      emailLimiter(settings.login, { skipSuccessfulRequests: true })
    ],
    register: [createLimiter(settings.register), emailLimiter(settings.register)],
    forgotPassword: [createLimiter(settings.forgotPassword), emailLimiter(settings.forgotPassword)],
    resendVerification: [
      createLimiter(settings.resendVerification),
      emailLimiter(settings.resendVerification)
    ],
    resetPassword: [createLimiter(settings.resetPassword)],
    invite: [
      createLimiter(settings.invite, {
        keyGenerator: (req) => String(req.user?.sub ?? "anonymous"),
        // Keys are user ids, not IP addresses.
        validate: { keyGeneratorIpFallback: false }
      })
    ]
  };
}
