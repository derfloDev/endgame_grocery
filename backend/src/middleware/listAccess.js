/**
 * Checks whether a user owns a list or is a member of it.
 *
 * @param {{ query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }> }} pool Database pool.
 * @param {string} listId List identifier.
 * @param {string} userId Authenticated user identifier.
 * @returns {Promise<boolean>} Whether the user can access the list.
 */
export async function ensureListAccess(pool, listId, userId) {
  const result = await pool.query(
    `
      SELECT l.id
      FROM lists l
      LEFT JOIN list_members lm
        ON lm.list_id = l.id
       AND lm.user_id = $2
      WHERE l.id = $1
        AND (l.owner_id = $2 OR lm.user_id = $2)
      LIMIT 1
    `,
    [listId, userId]
  );

  return Boolean(result.rows[0]);
}
