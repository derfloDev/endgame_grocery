export const MIN_PASSWORD_LENGTH = 8;
// bcrypt only hashes the first 72 bytes, so longer passwords would be silently truncated.
export const MAX_PASSWORD_BYTES = 72;

/**
 * Validates a new password for registration and password reset.
 *
 * @param {unknown} password Candidate password.
 * @returns {string | null} A user-facing error message, or null when the password is acceptable.
 */
export function validatePassword(password) {
  if (typeof password !== "string") {
    return "Password must be a string.";
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
  }

  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return `Password must be at most ${MAX_PASSWORD_BYTES} bytes long.`;
  }

  return null;
}
