import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";

function createAuthedApp(pool, options = {}) {
  return createApp({
    mailer: options.mailer,
    pool,
    sseManager: options.sseManager ?? createSseManagerSpy(),
    requireAuthMiddleware(req, _res, next) {
      req.user = { sub: "user-1" };
      next();
    }
  });
}

const LIST_ONE = "10000000-0000-4000-8000-000000000001";

describe("list routes", () => {
  it("returns one list with owner details for an accessible list", async () => {
    const queries = [];
    const pool = {
      async query(sql, params) {
        queries.push([sql.replace(/\s+/g, " ").trim(), params]);

        if (queries.length === 1) {
          return { rows: [{ id: LIST_ONE }] };
        }

        return {
          rows: [
            {
              id: LIST_ONE,
              name: "Weekly groceries",
              owner_id: "user-2",
              owner_name: "Alex",
              is_owner: false,
              created_at: new Date("2026-04-21T00:00:00.000Z")
            }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).get(`/api/lists/${LIST_ONE}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      list: {
        id: LIST_ONE,
        name: "Weekly groceries",
        owner_id: "user-2",
        owner_name: "Alex",
        is_owner: false,
        created_at: "2026-04-21T00:00:00.000Z"
      }
    });
    assert.match(queries[0][0], /FROM lists l LEFT JOIN list_members lm/);
    assert.deepEqual(queries[0][1], [LIST_ONE, "user-1"]);
    assert.match(queries[1][0], /JOIN users owner ON owner\.id = l\.owner_id WHERE l\.id = \$2/);
    assert.deepEqual(queries[1][1], ["user-1", LIST_ONE]);
  });

  it("answers 403 for a list the user cannot access", async () => {
    const queries = [];
    const pool = {
      async query(sql) {
        queries.push(sql);
        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool)).get(`/api/lists/${LIST_ONE}`);

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { error: "You do not have access to this list." });
    assert.equal(queries.length, 1);
  });

  it("answers 404 for a malformed list id", async () => {
    const response = await request(createAuthedApp({ async query() { throw new Error("no query"); } })).get(
      "/api/lists/not-a-uuid"
    );

    assert.equal(response.status, 404);
  });

  it("returns all owned and shared lists", async () => {
    const pool = {
      async query() {
        return {
          rows: [
            {
              id: "10000000-0000-4000-8000-000000000001",
              name: "Weekly groceries",
              owner_id: "user-1",
              owner_name: "Demo User",
              is_owner: true,
              changed_count: "2",
              created_at: new Date("2026-04-21T00:00:00.000Z"),
              last_activity: new Date("2026-04-23T00:00:00.000Z")
            },
            {
              id: "10000000-0000-4000-8000-000000000002",
              name: "BBQ party",
              owner_id: "user-2",
              owner_name: "Alex",
              is_owner: false,
              changed_count: "0",
              created_at: new Date("2026-04-22T00:00:00.000Z"),
              last_activity: new Date("2026-04-22T00:00:00.000Z")
            }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/lists");

    assert.equal(response.status, 200);
    assert.equal(response.body.lists.length, 2);
    assert.equal(response.body.lists[1].is_owner, false);
    assert.equal(response.body.lists[0].changed_count, 2);
    assert.equal(response.body.lists[1].changed_count, 0);
    assert.equal(response.body.lists[0].created_at, "2026-04-21T00:00:00.000Z");
    assert.equal(response.body.lists[0].last_activity, "2026-04-23T00:00:00.000Z");
    assert.equal(response.body.lists[1].created_at, "2026-04-22T00:00:00.000Z");
    assert.equal(response.body.lists[1].last_activity, response.body.lists[1].created_at);
  });

  it("computes changed counts from list views and entries", async () => {
    const pool = {
      async query(sql, params) {
        assert.match(sql, /LEFT JOIN list_views lv/);
        assert.match(sql, /changed_count/);
        assert.match(sql, /lv\.last_viewed_at IS NOT NULL/);
        assert.match(sql, /e\.last_updated_by IS NULL OR e\.last_updated_by <> \$1/);
        assert.match(sql, /l\.created_at/);
        assert.match(sql, /MAX\(e\.updated_at\)/);
        assert.match(sql, /last_activity/);
        assert.deepEqual(params, ["user-1"]);
        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/lists");

    assert.equal(response.status, 200);
  });

  it("marks a list viewed for the authenticated user", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          assert.match(sql, /SELECT l\.id\s+FROM lists l/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001", "user-1"]);
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        assert.match(sql, /INSERT INTO list_views/);
        assert.match(sql, /ON CONFLICT \(user_id, list_id\)/);
        assert.deepEqual(params, ["user-1", "10000000-0000-4000-8000-000000000001"]);
        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool)).post("/api/lists/10000000-0000-4000-8000-000000000001/mark-viewed");

    assert.equal(response.status, 204);
    assert.equal(callCount, 2);
  });

  it("creates a list for the authenticated owner", async () => {
    const pool = {
      async query() {
        return {
          rows: [{ id: "10000000-0000-4000-8000-000000000001", name: "Weekend run", owner_id: "user-1" }]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).post("/api/lists").send({
      name: "Weekend run"
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.list.is_owner, true);
  });

  it("renames a list only when the caller is the owner", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        return {
          rows: [{ id: "10000000-0000-4000-8000-000000000001", name: "Renamed", owner_id: "user-1" }]
        };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager }))
      .patch("/api/lists/10000000-0000-4000-8000-000000000001")
      .send({
      name: "Renamed"
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.list.name, "Renamed");
    assert.deepEqual(sseManager.calls, [
      ["10000000-0000-4000-8000-000000000001", "list:updated", { listId: "10000000-0000-4000-8000-000000000001" }]
    ]);
  });

  it("rejects renaming when the caller is not the owner", async () => {
    const sseManager = createSseManagerSpy();
    const pool = {
      async query() {
        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager }))
      .patch("/api/lists/10000000-0000-4000-8000-000000000001")
      .send({
      name: "Renamed"
    });

    assert.equal(response.status, 403);
    assert.deepEqual(sseManager.calls, []);
  });

  it("deletes a list only when the caller is the owner", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query(sql) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        // The recipients were read before the delete, but nobody is notified until it succeeded.
        assert.match(sql, /DELETE FROM lists/);
        assert.deepEqual(sseManager.direct, []);
        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager })).delete("/api/lists/10000000-0000-4000-8000-000000000001");

    assert.equal(response.status, 204);
    assert.equal(callCount, 2);
    assert.deepEqual(sseManager.calls, []);
    assert.deepEqual(sseManager.direct, [
      [["user-1", "user-2"], "list:deleted", { listId: "10000000-0000-4000-8000-000000000001" }]
    ]);
  });

  it("deletes the list even when the recipients cannot be read or the notification fails", async () => {
    for (const failure of ["recipients", "send"]) {
      const sseManager = createSseManagerSpy();
      if (failure === "recipients") {
        sseManager.getListRecipients = () => Promise.reject(new Error("database busy"));
      } else {
        sseManager.sendToUsers = () => {
          throw new Error("socket closed");
        };
      }
      let deleted = false;
      let callCount = 0;
      const pool = {
        async query(sql) {
          callCount += 1;
          if (callCount === 1) {
            return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
          }
          if (/DELETE FROM lists/.test(sql)) {
            deleted = true;
          }
          return { rows: [] };
        }
      };

      const response = await request(createAuthedApp(pool, { sseManager })).delete("/api/lists/10000000-0000-4000-8000-000000000001");

      assert.equal(response.status, 204, failure);
      assert.equal(deleted, true, failure);
    }
  });

  it("does not notify anyone when the delete itself fails", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;
        if (callCount === 1) {
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }
        throw new Error("delete failed");
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager })).delete("/api/lists/10000000-0000-4000-8000-000000000001");

    assert.equal(response.status, 500);
    assert.deepEqual(sseManager.direct, []);
  });

  it("does not broadcast delete events when the caller is not the owner", async () => {
    const sseManager = createSseManagerSpy();
    const pool = {
      async query() {
        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager })).delete("/api/lists/10000000-0000-4000-8000-000000000001");

    assert.equal(response.status, 403);
    assert.deepEqual(sseManager.calls, []);
  });

  it("lets a shared member leave and notifies the owner", async () => {
    const sseManager = createSseManagerSpy();
    const sentMessages = [];
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          assert.match(sql, /JOIN users owner/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001"]);
          return {
            rows: [
              {
                id: "10000000-0000-4000-8000-000000000001",
                name: "Weekly groceries",
                owner_id: "user-2",
                owner_display_name: "Alex",
                owner_email: "alex@example.com"
              }
            ]
          };
        }

        assert.match(sql, /DELETE FROM list_members/);
        assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001", "user-1"]);
        return {
          rows: [{ user_id: "user-1", display_name: "Demo User" }]
        };
      }
    };

    const response = await request(
      createAuthedApp(pool, {
        mailer: {
          async send(message) {
            sentMessages.push(message);
          }
        },
        sseManager
      })
    ).delete("/api/lists/10000000-0000-4000-8000-000000000001/leave");

    assert.equal(response.status, 204);
    assert.equal(callCount, 2);
    assert.deepEqual(sseManager.calls, [
      ["10000000-0000-4000-8000-000000000001", "member:removed", { listId: "10000000-0000-4000-8000-000000000001", userId: "user-1" }]
    ]);
    // The leaving user is no longer a member, so the list broadcast cannot reach them; they get
    // the event directly (for their other tabs and devices).
    assert.deepEqual(sseManager.direct, [
      [["user-1"], "member:removed", { listId: "10000000-0000-4000-8000-000000000001", userId: "user-1" }]
    ]);
    assert.deepEqual(sentMessages, [
      {
        to: "alex@example.com",
        subject: "Demo User left Weekly groceries",
        template: "member-left",
        context: {
          heading: "A member left your list",
          intro: "Hi Alex,",
          body: "Demo User left the shared list \"Weekly groceries\".",
          listName: "Weekly groceries",
          memberName: "Demo User"
        }
      }
    ]);
  });

  it("rejects an owner leaving their own list", async () => {
    const sseManager = createSseManagerSpy();
    const pool = {
      async query() {
        return {
          rows: [
            {
              id: "10000000-0000-4000-8000-000000000001",
              name: "Weekly groceries",
              owner_id: "user-1",
              owner_display_name: "Demo User",
              owner_email: "demo@example.com"
            }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager })).delete(
      "/api/lists/10000000-0000-4000-8000-000000000001/leave"
    );

    assert.equal(response.status, 403);
    assert.deepEqual(sseManager.calls, []);
  });

  it("returns not found when a non-member tries to leave", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return {
            rows: [
              {
                id: "10000000-0000-4000-8000-000000000001",
                name: "Weekly groceries",
                owner_id: "user-2",
                owner_display_name: "Alex",
                owner_email: "alex@example.com"
              }
            ]
          };
        }

        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager })).delete(
      "/api/lists/10000000-0000-4000-8000-000000000001/leave"
    );

    assert.equal(response.status, 404);
    assert.deepEqual(sseManager.calls, []);
  });
});

function createSseManagerSpy({ recipients = ["user-1", "user-2"] } = {}) {
  return {
    calls: [],
    direct: [],
    broadcastToList(pool, listId, eventType, data) {
      void pool;
      this.calls.push([listId, eventType, data]);
      return Promise.resolve();
    },
    sendToUsers(userIds, eventType, data) {
      this.direct.push([Array.from(userIds), eventType, data]);
    },
    getListRecipients() {
      return Promise.resolve(recipients);
    }
  };
}
