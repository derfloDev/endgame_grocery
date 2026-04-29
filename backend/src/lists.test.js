import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";

function createAuthedApp(pool, options = {}) {
  return createApp({
    pool,
    sseManager: options.sseManager ?? createSseManagerSpy(),
    requireAuthMiddleware(req, _res, next) {
      req.user = { sub: "user-1" };
      next();
    }
  });
}

describe("list routes", () => {
  it("returns all owned and shared lists", async () => {
    const pool = {
      async query() {
        return {
          rows: [
            {
              id: "list-1",
              name: "Weekly groceries",
              owner_id: "user-1",
              owner_name: "Demo User",
              is_owner: true
            },
            {
              id: "list-2",
              name: "BBQ party",
              owner_id: "user-2",
              owner_name: "Alex",
              is_owner: false
            }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/lists");

    assert.equal(response.status, 200);
    assert.equal(response.body.lists.length, 2);
    assert.equal(response.body.lists[1].is_owner, false);
  });

  it("creates a list for the authenticated owner", async () => {
    const pool = {
      async query() {
        return {
          rows: [{ id: "list-1", name: "Weekend run", owner_id: "user-1" }]
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
          return { rows: [{ id: "list-1" }] };
        }

        return {
          rows: [{ id: "list-1", name: "Renamed", owner_id: "user-1" }]
        };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager }))
      .patch("/api/lists/list-1")
      .send({
      name: "Renamed"
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.list.name, "Renamed");
    assert.deepEqual(sseManager.calls, [
      ["list-1", "list:updated", { listId: "list-1" }]
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
      .patch("/api/lists/list-1")
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
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        assert.deepEqual(sseManager.calls, [
          ["list-1", "list:deleted", { listId: "list-1" }]
        ]);
        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager })).delete("/api/lists/list-1");

    assert.equal(response.status, 204);
    assert.equal(callCount, 2);
  });

  it("does not broadcast delete events when the caller is not the owner", async () => {
    const sseManager = createSseManagerSpy();
    const pool = {
      async query() {
        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager })).delete("/api/lists/list-1");

    assert.equal(response.status, 403);
    assert.deepEqual(sseManager.calls, []);
  });
});

function createSseManagerSpy() {
  return {
    calls: [],
    broadcastToList(pool, listId, eventType, data) {
      void pool;
      this.calls.push([listId, eventType, data]);
      return Promise.resolve();
    }
  };
}
