/**
 * Upserts one autocomplete history item for a user's list.
 *
 * @param {import("pg").Pool} pool Database pool.
 * @param {{ userId: string, listId: string, text: string, icon?: string | null, details?: string | null }} historyItem History item fields.
 * @returns {Promise<import("pg").QueryResult>} Database query result.
 */
export function upsertAutocompleteHistory(pool, { userId, listId, text, icon, details = null }) {
  return pool.query(
    `
      INSERT INTO autocomplete_history (user_id, list_id, text, icon, details, use_count, last_used_at)
      VALUES ($1, $2, $3, $4, $5, 1, NOW())
      ON CONFLICT (user_id, list_id, text)
      DO UPDATE SET
        icon = EXCLUDED.icon,
        details = EXCLUDED.details,
        use_count = autocomplete_history.use_count + 1,
        last_used_at = NOW()
    `,
    [userId, listId, text, icon, details]
  );
}
