export class SseManager {
  constructor() {
    this.connections = new Map();
  }

  add(userId, res) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }

    this.connections.get(userId).add(res);
  }

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
