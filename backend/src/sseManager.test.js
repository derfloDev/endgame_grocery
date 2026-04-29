import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SseManager } from "./sseManager.js";

describe("SseManager", () => {
  it("adds and removes connections per user", () => {
    const manager = new SseManager();
    const resA = createResponse();
    const resB = createResponse();

    manager.add("user-1", resA);
    manager.add("user-1", resB);
    manager.add("user-2", createResponse());

    assert.equal(manager.connections.get("user-1").size, 2);
    assert.equal(manager.connections.get("user-2").size, 1);

    manager.remove("user-1", resA);
    assert.equal(manager.connections.get("user-1").size, 1);

    manager.remove("user-1", resB);
    assert.equal(manager.connections.has("user-1"), false);
    assert.equal(manager.connections.get("user-2").size, 1);
  });

  it("sends SSE payloads to active connections and skips closed ones", () => {
    const manager = new SseManager();
    const openA = createResponse();
    const openB = createResponse();
    const closed = createResponse({ destroyed: true });

    manager.add("user-1", openA);
    manager.add("user-1", closed);
    manager.add("user-2", openB);

    manager.sendToUsers(["user-1", "user-2"], "entry:created", {
      listId: "list-1",
      entryId: "entry-1"
    });

    assert.deepEqual(openA.writes, [
      'event: entry:created\ndata: {"listId":"list-1","entryId":"entry-1"}\n\n'
    ]);
    assert.deepEqual(openB.writes, [
      'event: entry:created\ndata: {"listId":"list-1","entryId":"entry-1"}\n\n'
    ]);
    assert.deepEqual(closed.writes, []);
    assert.equal(manager.connections.get("user-1").has(closed), false);
  });

  it("looks up all list recipients before broadcasting", async () => {
    const manager = new SseManager();
    const sent = [];
    const pool = {
      async query(sql, params) {
        assert.match(sql, /FROM lists/);
        assert.match(sql, /FROM list_members/);
        assert.deepEqual(params, ["list-1"]);

        return {
          rows: [{ user_id: "owner-1" }, { user_id: "member-1" }, { user_id: "member-1" }]
        };
      }
    };

    manager.sendToUsers = (userIds, eventType, data) => {
      sent.push({ userIds, eventType, data });
    };

    await manager.broadcastToList(pool, "list-1", "list:updated", { listId: "list-1" });

    assert.deepEqual(sent, [
      {
        userIds: ["owner-1", "member-1"],
        eventType: "list:updated",
        data: { listId: "list-1" }
      }
    ]);
  });
});

function createResponse({ destroyed = false } = {}) {
  return {
    destroyed,
    writableEnded: destroyed,
    writes: [],
    write(chunk) {
      this.writes.push(chunk);
    }
  };
}
