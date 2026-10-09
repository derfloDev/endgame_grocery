import { withTransaction } from "./db/client.js";
import { isUuid } from "./middleware/validateUuid.js";
import { hashToken } from "./tokens.js";

/**
 * Finds a pending, unexpired invite by token. Invite tokens are stored hashed, so the presented
 * plaintext is hashed before the lookup.
 *
 * @param {import("pg").Pool} pool Database pool.
 * @param {string} token Invite token.
 * @param {Date} now Current time.
 * @returns {Promise<object | null>} Pending invite row, or null when not found.
 */
export async function getPendingInviteByToken(pool, token, now) {
  // Invite tokens are generated as UUIDs; anything else cannot match, so skip the query.
  if (!isUuid(token)) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT id, list_id, invited_email, status
      FROM list_invites
      WHERE token_hash = $1
        AND status = 'pending'
        AND expires_at > $2
      LIMIT 1
    `,
    [hashToken(token), now]
  );

  return result.rows[0] ?? null;
}

/**
 * Accepts an invite for a user and adds list membership.
 *
 * The invite is claimed with one conditional UPDATE inside a transaction, so concurrent requests
 * with the same token cannot both succeed: exactly one gets the row back, the others get `null`.
 * Callers must have verified that the invite belongs to the user's email address.
 *
 * @param {object} options Invite acceptance options.
 * @param {import("pg").Pool} options.pool Database pool.
 * @param {{ query: Function }} [options.client] Client of a transaction the caller already opened
 *   (for example registration); the claim and the membership insert then join it instead of
 *   starting their own.
 * @param {{ id: string, list_id: string }} options.invite Invite row.
 * @param {string} options.userId User accepting the invite.
 * @param {Date} [options.now] Current time, used for the expiry check.
 * @returns {Promise<{ listId: string, memberAdded: boolean } | null>} Acceptance result, or null
 *   when the invite was already used or has expired in the meantime.
 */
export async function acceptInviteForUser({ pool, client, invite, userId, now = new Date() }) {
  const run = async (executor) => {
    const claim = await executor.query(
      `
        UPDATE list_invites
        SET status = 'accepted'
        WHERE id = $1
          AND status = 'pending'
          AND expires_at > $2
        RETURNING list_id
      `,
      [invite.id, now]
    );
    const claimed = claim.rows[0];

    if (!claimed) {
      return null;
    }

    const membership = await executor.query(
      `
        INSERT INTO list_members (list_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        RETURNING user_id
      `,
      [claimed.list_id, userId]
    );

    return {
      listId: claimed.list_id,
      memberAdded: membership.rows.length > 0
    };
  };

  return client ? run(client) : withTransaction(pool, run);
}

/**
 * Checks whether an invite was addressed to the given email address (case-insensitive).
 *
 * @param {string | undefined} invitedEmail Email stored on the invite.
 * @param {string | undefined} userEmail Email of the account that wants to accept it.
 * @returns {boolean} Whether both addresses are the same.
 */
export function isInviteForEmail(invitedEmail, userEmail) {
  return Boolean(invitedEmail) && Boolean(userEmail) && invitedEmail.toLowerCase() === userEmail.toLowerCase();
}
