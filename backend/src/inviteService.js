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
