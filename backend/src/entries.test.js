import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";

function createAuthedApp(pool) {
  return createApp({
    pool,
    requireAuthMiddleware(req, _res, next) {
      req.user = { sub: "user-1" };
      next();
    }
  });
}

describe("entry routes", () => {
  it("returns entries with icon values for accessible lists", async () => {
    let callCount = 0;
    const pool = {
      async query(sql) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        assert.match(sql, /SELECT id, list_id, text, status, icon, created_at, updated_at/);

        return {
          rows: [
            { id: "entry-1", list_id: "list-1", text: "Milk", status: "open", icon: "🥛" },
            { id: "entry-2", list_id: "list-1", text: "Bread", status: "done", icon: null }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/lists/list-1/entries");

    assert.equal(response.status, 200);
    assert.equal(response.body.entries.length, 2);
    assert.deepEqual(response.body.entries, [
      { id: "entry-1", list_id: "list-1", text: "Milk", status: "open", icon: "🥛" },
      { id: "entry-2", list_id: "list-1", text: "Bread", status: "done", icon: null }
    ]);
  });

  it("creates an entry with an icon for an accessible list", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        assert.match(sql, /INSERT INTO entries \(list_id, text, status, icon\)/);
        assert.deepEqual(params, ["list-1", "Milk", "🥛"]);

        return {
          rows: [{ id: "entry-1", list_id: "list-1", text: "Milk", status: "open", icon: "🥛" }]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).post("/api/lists/list-1/entries").send({
      text: "Milk",
      icon: "🥛"
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.entry.status, "open");
    assert.equal(response.body.entry.icon, "🥛");
  });

  it("updates entry text and status", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        return {
          rows: [{ id: "entry-1", list_id: "list-1", text: "Oat milk", status: "done" }]
        };
      }
    };

    const response = await request(createAuthedApp(pool))
      .patch("/api/lists/list-1/entries/entry-1")
      .send({
        text: "Oat milk",
        status: "done"
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.entry.text, "Oat milk");
    assert.equal(response.body.entry.status, "done");
  });

  it("updates an entry icon without requiring text or status", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        assert.match(sql, /icon = COALESCE\(\$3, icon\)/);
        assert.deepEqual(params, [null, null, "🥛", "entry-1", "list-1"]);

        return {
          rows: [{ id: "entry-1", list_id: "list-1", text: "Milk", status: "open", icon: "🥛" }]
        };
      }
    };

    const response = await request(createAuthedApp(pool))
      .patch("/api/lists/list-1/entries/entry-1")
      .send({
        icon: "🥛"
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.entry.icon, "🥛");
  });

  it("deletes an entry", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        return { rows: [{ id: "entry-1" }] };
      }
    };

    const response = await request(createAuthedApp(pool)).delete("/api/lists/list-1/entries/entry-1");

    assert.equal(response.status, 204);
  });
});
