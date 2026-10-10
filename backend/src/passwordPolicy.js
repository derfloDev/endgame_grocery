export const MIN_PASSWORD_LENGTH = 8;
// bcrypt only hashes the first 72 bytes, so longer passwords would be silently truncated.
export const MAX_PASSWORD_BYTES = 72;

/**
 * Validates a new password and names the rule that failed.
 *
 * @param {unknown} password Candidate password.
 * @returns {{ code: string, message: string } | null} The violated rule (API error code and
 *   English message), or null when the password is acceptable.
 */
export function checkPassword(password) {
  if (typeof password !== "string") {
    return { code: "validation.password_invalid", message: "Password must be a string." };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      code: "validation.password_too_short",
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
    };
  }

  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return {
      code: "validation.password_too_long",
      message: `Password must be at most ${MAX_PASSWORD_BYTES} bytes long.`
    };
  }

  return null;
}

/**
 * Validates a new password for registration and password reset.
 *
 * @param {unknown} password Candidate password.
 * @returns {string | null} A user-facing error message, or null when the password is acceptable.
 */
export function validatePassword(password) {
  return checkPassword(password)?.message ?? null;
}
