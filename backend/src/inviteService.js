/**
 * Finds a pending, unexpired invite by token.
 *
 * @param {import("pg").Pool} pool Database pool.
 * @param {string} token Invite token.
 * @param {Date} now Current time.
 * @returns {Promise<object | null>} Pending invite row, or null when not found.
 */
export async function getPendingInviteByToken(pool, token, now) {
  const result = await pool.query(
    `
      SELECT id, list_id, invited_email, status
      FROM list_invites
      WHERE token = $1
        AND status = 'pending'
        AND expires_at > $2
      LIMIT 1
    `,
    [token, now]
  );

  return result.rows[0] ?? null;
}

/**
 * Accepts an invite for a user and adds list membership when needed.
 *
 * @param {object} options Invite acceptance options.
 * @param {import("pg").Pool} options.pool Database pool.
 * @param {{ id: string, list_id: string }} options.invite Invite row.
 * @param {string} options.userId User accepting the invite.
 * @returns {Promise<{ listId: string, memberAdded: boolean }>} Acceptance result.
 */
export async function acceptInviteForUser({ pool, invite, userId }) {
  const existingMemberResult = await pool.query(
    `
      SELECT user_id FROM list_members
      WHERE list_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [invite.list_id, userId]
  );

  let memberAdded = false;

  if (!existingMemberResult.rows[0]) {
    await pool.query(
      `
        INSERT INTO list_members (list_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [invite.list_id, userId]
    );
    memberAdded = true;
  }

  await pool.query(
    `
      UPDATE list_invites
      SET status = 'accepted'
      WHERE id = $1
    `,
    [invite.id]
  );

  return {
    listId: invite.list_id,
    memberAdded
  };
}
