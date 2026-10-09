import { createHash, randomUUID } from "node:crypto";

/**
 * Generates a new one-time token or API key. Only the plaintext value that is sent to the user
 * (in a mail or the API response) ever exists in memory; the database stores `hashToken(value)`.
 *
 * @returns {string} Random UUID.
 */
export function generateToken() {
  return randomUUID();
}

/**
 * Hashes a token, invite token or API key for storage and lookup.
 *
 * SHA-256 is enough here because the values are 122-bit random UUIDs, not passwords. The input is
 * trimmed and lower-cased first: these columns used to be `uuid`, which compares case-insensitively,
 * and the migration hashes the lower-case text form of the stored value.
 *
 * @param {unknown} token Presented or freshly generated token.
 * @returns {string} Lower-case hex SHA-256 digest.
 */
export function hashToken(token) {
  return createHash("sha256").update(String(token).trim().toLowerCase(), "utf8").digest("hex");
}

/**
 * Returns the last four characters of an API key, which the UI shows to tell keys apart.
 *
 * @param {string} apiKey Plaintext API key.
 * @returns {string} Hint.
 */
export function getApiKeyHint(apiKey) {
  return String(apiKey).slice(-4);
}
