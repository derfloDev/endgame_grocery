import { describe, it } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import request from "supertest";
import { createApp } from "./app.js";
import { SseManager } from "./sseManager.js";

const LIST = "10000000-0000-4000-8000-000000000001";
const OWNER = "30000000-0000-4000-8000-000000000001";
const MEMBER = "30000000-0000-4000-8000-000000000002";
const OTHER_MEMBER = "30000000-0000-4000-8000-000000000003";

function createStream() {
  return {
    destroyed: false,
    writableEnded: false,
    writes: [],
    write(chunk) {
      this.writes.push(chunk);
    }
  };
}

function eventsOf(stream) {
  return stream.writes.map((chunk) => {
    const [, type] = chunk.match(/^event: (.+)\n/);
    const [, data] = chunk.match(/\ndata: (.+)\n\n$/);
    return [type, JSON.parse(data)];
  });
}

/**
 * Builds an app with the real SseManager and one open stream per user. The pool mock models the
 * state after each statement: members that were deleted no longer show up as recipients.
 */
function createFixture({ currentUser, members }) {
  const sseManager = new SseManager();
  const streams = { [OWNER]: createStream(), [MEMBER]: createStream(), [OTHER_MEMBER]: createStream() };
  for (const [userId, stream] of Object.entries(streams)) {
    sseManager.add(userId, stream);
  }
  const state = { members: [...members], listExists: true };
  const pool = {
    async query(sql, params) {
      const text = sql.replace(/\s+/g, " ").trim();

      if (/^SELECT owner_id AS user_id/.test(text)) {
        return {
          rows: state.listExists ? [{ user_id: OWNER }, ...state.members.map((user_id) => ({ user_id }))] : []
        };
      }

      if (/JOIN users owner/.test(text)) {
        return {
          rows: [{ id: LIST, name: "Weekly", owner_id: OWNER, owner_display_name: "Owner", owner_email: "o@example.com", created_at: "now" }]
        };
      }

      if (/SELECT id FROM lists WHERE id = \$1 AND owner_id = \$2/.test(text)) {
        return { rows: params[1] === OWNER ? [{ id: LIST }] : [] };
      }

      if (/FROM lists l\b.*JOIN users owner|SELECT l\.id, l\.name, l\.owner_id/.test(text)) {
        return { rows: [{ id: LIST, name: "Weekly", owner_id: OWNER, owner_display_name: "Owner", owner_email: "o@example.com", created_at: "now" }] };
      }

      if (/^DELETE FROM list_members/.test(text)) {
        const userId = params[1];
        const index = state.members.indexOf(userId);
        if (index === -1) {
          return { rows: [] };
        }
        state.members.splice(index, 1);
        return { rows: [{ user_id: userId, email: "removed@example.com", display_name: "Removed" }] };
      }

      if (/^DELETE FROM lists/.test(text)) {
        state.listExists = false;
        state.members = [];
        return { rows: [] };
      }

      return { rows: [] };
    }
  };
  const app = createApp({
    pool,
    startWorkers: false,
    logger: pino({ level: "silent" }),
    sseManager,
    mailer: { async send() {} },
    requireAuthMiddleware(req, _res, next) {
      req.user = { sub: currentUser };
      next();
    }
  });

  return { app, streams, state };
}

describe("membership and list lifecycle events", () => {
  it("delivers member:removed to the member the owner removed and to everyone who stays", async () => {
    const { app, streams } = createFixture({ currentUser: OWNER, members: [MEMBER, OTHER_MEMBER] });

    const response = await request(app).delete(`/api/lists/${LIST}/members/${MEMBER}`);

    assert.equal(response.status, 204);
    const payload = { listId: LIST, userId: MEMBER };
    assert.deepEqual(eventsOf(streams[MEMBER]), [["member:removed", payload]]);
    assert.deepEqual(eventsOf(streams[OWNER]), [["member:removed", payload]]);
    assert.deepEqual(eventsOf(streams[OTHER_MEMBER]), [["member:removed", payload]]);
  });

  it("delivers member:removed to the leaving member exactly once and to the others", async () => {
    const { app, streams } = createFixture({ currentUser: MEMBER, members: [MEMBER, OTHER_MEMBER] });

    const response = await request(app).delete(`/api/lists/${LIST}/leave`);

    assert.equal(response.status, 204);
    const payload = { listId: LIST, userId: MEMBER };
    assert.deepEqual(eventsOf(streams[MEMBER]), [["member:removed", payload]]);
    assert.deepEqual(eventsOf(streams[OWNER]), [["member:removed", payload]]);
    assert.deepEqual(eventsOf(streams[OTHER_MEMBER]), [["member:removed", payload]]);
  });

  it("sends list:deleted to the owner and all members after the list was deleted", async () => {
    const { app, streams, state } = createFixture({ currentUser: OWNER, members: [MEMBER, OTHER_MEMBER] });

    const response = await request(app).delete(`/api/lists/${LIST}`);

    assert.equal(response.status, 204);
    assert.equal(state.listExists, false);
    for (const userId of [OWNER, MEMBER, OTHER_MEMBER]) {
      assert.deepEqual(eventsOf(streams[userId]), [["list:deleted", { listId: LIST }]], userId);
    }
  });

  it("does not announce a deletion that did not happen for a non-owner", async () => {
    const { app, streams, state } = createFixture({ currentUser: MEMBER, members: [MEMBER] });

    const response = await request(app).delete(`/api/lists/${LIST}`);

    assert.equal(response.status, 403);
    assert.equal(state.listExists, true);
    assert.deepEqual(streams[OWNER].writes, []);
  });
});

describe("SseManager.getListRecipients", () => {
  it("returns each owner and member once", async () => {
    const manager = new SseManager();
    const pool = {
      async query(sql, params) {
        assert.match(sql, /FROM lists/);
        assert.match(sql, /FROM list_members/);
        assert.deepEqual(params, ["list-1"]);
        return { rows: [{ user_id: "owner" }, { user_id: "member" }, { user_id: "member" }] };
      }
    };

    assert.deepEqual(await manager.getListRecipients(pool, "list-1"), ["owner", "member"]);
  });

  it("requires a database pool", async () => {
    await assert.rejects(new SseManager().getListRecipients(null, "list-1"), /Database connection/);
  });
});
