/**
 * Tracks server-sent event connections and broadcasts list events.
 */
export class SseManager {
  constructor() {
    this.connections = new Map();
  }

  /**
   * Adds a response stream to a user's active SSE connections.
   *
   * @param {string} userId User identifier.
   * @param {import("http").ServerResponse} res Open SSE response.
   * @returns {void}
   */
  add(userId, res) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }

    this.connections.get(userId).add(res);
  }

  /**
   * Removes a response stream from a user's active SSE connections.
   *
   * @param {string} userId User identifier.
   * @param {import("http").ServerResponse} res SSE response to remove.
   * @returns {void}
   */
  remove(userId, res) {
    const userConnections = this.connections.get(userId);

    if (!userConnections) {
      return;
    }

    userConnections.delete(res);

    if (userConnections.size === 0) {
      this.connections.delete(userId);
    }
  }

  /**
   * Sends an event payload to all active connections for the given users.
   *
   * @param {Iterable<string>} userIds User identifiers.
   * @param {string} eventType SSE event type.
   * @param {unknown} data JSON-serializable event payload.
   * @returns {void}
   */
  sendToUsers(userIds, eventType, data) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const userId of new Set(userIds)) {
      const userConnections = this.connections.get(userId);

      if (!userConnections) {
        continue;
      }

      for (const res of Array.from(userConnections)) {
        if (res.destroyed || res.writableEnded) {
          this.remove(userId, res);
          continue;
        }

        try {
          res.write(payload);
        } catch {
          this.remove(userId, res);
        }
      }
    }
  }

  /**
   * Broadcasts an event to the owner and members of a list.
   *
   * @param {import("pg").Pool} pool Database pool.
   * @param {string} listId List identifier.
   * @param {string} eventType SSE event type.
   * @param {unknown} data JSON-serializable event payload.
   * @returns {Promise<void>} Resolves after recipients are queried and notified.
   */
  async broadcastToList(pool, listId, eventType, data) {
    if (!pool) {
      throw new Error("Database connection is not configured.");
    }

    const result = await pool.query(
      `
        SELECT owner_id AS user_id
        FROM lists
        WHERE id = $1
        UNION
        SELECT user_id
        FROM list_members
        WHERE list_id = $1
      `,
      [listId]
    );

    this.sendToUsers(
      Array.from(new Set(result.rows.map((row) => row.user_id))),
      eventType,
      data
    );
  }
}

export const sseManager = new SseManager();
