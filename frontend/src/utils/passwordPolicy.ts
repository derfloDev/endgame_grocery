export const MIN_PASSWORD_LENGTH = 8;
// bcrypt on the server only hashes the first 72 bytes, so longer passwords are rejected there.
export const MAX_PASSWORD_BYTES = 72;

export type PasswordPolicyError = "tooShort" | "tooLong";

/**
 * Mirrors the server's password rule (at least 8 characters, at most 72 UTF-8 bytes) so the form
 * can explain the problem before sending the request.
 */
export function getPasswordPolicyError(password: string): PasswordPolicyError | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return "tooShort";
  }

  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return "tooLong";
  }

  return null;
}
