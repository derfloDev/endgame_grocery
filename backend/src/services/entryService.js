import { withTransaction } from "../db/client.js";
import { ensureListAccess } from "../middleware/listAccess.js";
import { enqueuePushJob } from "../workers/pushWorker.js";

export const MAX_OPEN_ENTRIES_PER_LIST = 1000;
export const MAX_DONE_ENTRIES_PER_LIST = 200;

const ENTRY_COLUMNS = "id, list_id, text, status, icon, details, created_at, updated_at, last_updated_by";

/**
 * Normalises a details/description value: non-strings and blank strings become null.
 *
 * @param {unknown} details Raw value from a request body.
 * @returns {string | null} Trimmed text, or null.
 */
export function normalizeDetails(details) {
  if (typeof details !== "string") {
    return null;
  }

  const trimmedDetails = details.trim();
  return trimmedDetails ? trimmedDetails : null;
}

/**
 * Sends an SSE event without ever failing or delaying the caller.
 *
 * @param {object} context Service context.
 * @param {string} eventType Event name.
 * @param {object} data Event payload.
 * @returns {void}
 */
function broadcast({ pool, sseManager, logger }, listId, eventType, data) {
  const onError = (error) => {
    logger.error({ err: error }, "Failed to broadcast SSE event");
  };

  try {
    void Promise.resolve(sseManager.broadcastToList(pool, listId, eventType, data)).catch(onError);
  } catch (error) {
    onError(error);
  }
}

/**
 * Lists the entries of a list.
 *
 * @param {object} context Service context.
 * @param {import("pg").Pool} context.pool Database pool.
 * @param {string} context.userId Acting user.
 * @param {string} context.listId List identifier.
 * @returns {Promise<{ status: "ok", entries: object[] } | { status: "forbidden" }>} Result.
 */
export async function listEntries({ pool, userId, listId }) {
  if (!(await ensureListAccess(pool, listId, userId))) {
    return { status: "forbidden" };
  }

  const result = await pool.query(
    `
      SELECT
        e.id,
        e.list_id,
        e.text,
        e.status,
        e.icon,
        e.details,
        e.created_at,
        e.updated_at,
        e.last_updated_by,
        (
          lv.last_viewed_at IS NOT NULL
          AND e.updated_at > lv.last_viewed_at
          AND (e.last_updated_by IS NULL OR e.last_updated_by <> $2)
        ) AS is_changed
      FROM entries e
      LEFT JOIN list_views lv
        ON lv.list_id = e.list_id
       AND lv.user_id = $2
      WHERE e.list_id = $1
      ORDER BY status ASC, created_at ASC
    `,
    [listId, userId]
  );

  return { status: "ok", entries: result.rows };
}

/**
 * Creates an open entry, enforcing the open-entry cap, then broadcasts it and queues the push job.
 *
 * @param {object} context Service context (`pool`, `sseManager`, `logger`, `userId`, `listId`).
 * @param {object} input Entry fields.
 * @param {string} input.text Already validated, non-empty text.
 * @param {string | null} [input.icon] Icon.
 * @param {unknown} [input.details] Details; normalised with {@link normalizeDetails}.
 * @returns {Promise<{ status: "ok", entry: object } | { status: "forbidden" } | { status: "limit_open" }>} Result.
 */
export async function createEntry(context, { text, icon, details }) {
  const { pool, userId, listId } = context;

  if (!(await ensureListAccess(pool, listId, userId))) {
    return { status: "forbidden" };
  }

  // The list row lock serialises concurrent creates, so the open-entry cap cannot be exceeded
  // by two requests that both counted before either inserted.
  const created = await withTransaction(pool, async (client) => {
    await client.query("SELECT 1 FROM lists WHERE id = $1 FOR UPDATE", [listId]);

    const openEntryCount = await client.query(
      `
        SELECT COUNT(*) AS cnt
        FROM entries
        WHERE list_id = $1 AND status = 'open'
      `,
      [listId]
    );

    if (Number(openEntryCount.rows[0]?.cnt) >= MAX_OPEN_ENTRIES_PER_LIST) {
      return null;
    }

    return client.query(
      `
        INSERT INTO entries (list_id, text, status, icon, details, last_updated_by)
        VALUES ($1, $2, 'open', $3, $4, $5)
        RETURNING ${ENTRY_COLUMNS}
      `,
      [listId, text, icon ?? null, normalizeDetails(details), userId]
    );
  });

  if (!created) {
    return { status: "limit_open" };
  }

  const entry = created.rows[0];

  broadcast(context, listId, "entry:created", { listId, entryId: entry.id });

  void enqueuePushJob({
    pool,
    listId,
    actorUserId: userId,
    entryText: entry.text,
    now: new Date()
  }).catch((pushError) => {
    context.logger.error({ err: pushError }, "Failed to queue push notification job");
  });

  return { status: "ok", entry };
}

/**
 * Updates an entry. Completing an entry (or toggling it) runs in a transaction that locks the
 * list and the entry, and evicts the oldest done entry only when an existing open entry is
 * completed at the done cap.
 *
 * @param {object} context Service context (`pool`, `sseManager`, `logger`, `userId`, `listId`).
 * @param {object} input Update fields.
 * @param {string} input.entryId Entry identifier.
 * @param {string} [input.text] New text (trimmed, empty means unchanged).
 * @param {"open" | "done"} [input.status] New status.
 * @param {boolean} [input.toggle] Flip the current status instead of setting `status`.
 * @param {string | null} [input.icon] New icon (undefined/null keep the current one).
 * @param {boolean} [input.hasDetails] Whether `details` should be written.
 * @param {unknown} [input.details] New details when `hasDetails` is set.
 * @returns {Promise<{ status: "ok", entry: object } | { status: "forbidden" } | { status: "not_found" }>} Result.
 */
export async function updateEntry(context, { entryId, text, status, toggle = false, icon, hasDetails = false, details }) {
  const { pool, userId, listId } = context;

  if (!(await ensureListAccess(pool, listId, userId))) {
    return { status: "forbidden" };
  }

  const write = (executor, nextStatus) =>
    executor.query(
      `
        UPDATE entries
        SET
          text = COALESCE($1, text),
          status = COALESCE($2, status),
          icon = COALESCE($3, icon),
          details = CASE WHEN $4 THEN $5 ELSE details END,
          last_updated_by = $6,
          updated_at = NOW()
        WHERE id = $7 AND list_id = $8
        RETURNING ${ENTRY_COLUMNS}
      `,
      [
        text?.trim() || null,
        nextStatus ?? null,
        icon ?? null,
        hasDetails,
        hasDetails ? normalizeDetails(details) : null,
        userId,
        entryId,
        listId
      ]
    );

  let result;

  if (status === "done" || toggle) {
    result = await withTransaction(pool, async (client) => {
      await client.query("SELECT 1 FROM lists WHERE id = $1 FOR UPDATE", [listId]);

      const current = await client.query(
        "SELECT status FROM entries WHERE id = $1 AND list_id = $2 FOR UPDATE",
        [entryId, listId]
      );

      if (!current.rows[0]) {
        return { rows: [] };
      }

      const currentStatus = current.rows[0].status;
      const nextStatus = toggle ? (currentStatus === "done" ? "open" : "done") : status;

      if (nextStatus === "done" && currentStatus === "open") {
        const doneEntryCount = await client.query(
          `
            SELECT COUNT(*) AS cnt
            FROM entries
            WHERE list_id = $1 AND status = 'done'
          `,
          [listId]
        );

        if (Number(doneEntryCount.rows[0]?.cnt) >= MAX_DONE_ENTRIES_PER_LIST) {
          await client.query(
            `
              DELETE FROM entries
              WHERE id = (
                SELECT id
                FROM entries
                WHERE list_id = $1 AND status = 'done' AND id <> $2
                ORDER BY updated_at ASC, created_at ASC
                LIMIT 1
              )
            `,
            [listId, entryId]
          );
        }
      }

      return write(client, nextStatus);
    });
  } else {
    result = await write(pool, status);
  }

  if (!result.rows[0]) {
    return { status: "not_found" };
  }

  broadcast(context, listId, "entry:updated", { listId, entryId });

  return { status: "ok", entry: result.rows[0] };
}

/**
 * Deletes an entry.
 *
 * @param {object} context Service context (`pool`, `sseManager`, `logger`, `userId`, `listId`).
 * @param {object} input Input.
 * @param {string} input.entryId Entry identifier.
 * @returns {Promise<{ status: "ok" } | { status: "forbidden" } | { status: "not_found" }>} Result.
 */
export async function deleteEntry(context, { entryId }) {
  const { pool, userId, listId } = context;

  if (!(await ensureListAccess(pool, listId, userId))) {
    return { status: "forbidden" };
  }

  const result = await pool.query(
    `
      DELETE FROM entries
      WHERE id = $1 AND list_id = $2
      RETURNING id
    `,
    [entryId, listId]
  );

  if (!result.rows[0]) {
    return { status: "not_found" };
  }

  broadcast(context, listId, "entry:deleted", { listId, entryId });

  return { status: "ok" };
}
