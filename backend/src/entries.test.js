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

        if (callCount === 2) {
          assert.match(sql, /INSERT INTO entries \(list_id, text, status, icon\)/);
          assert.deepEqual(params, ["list-1", "Milk", "🥛"]);

          return {
            rows: [{ id: "entry-1", list_id: "list-1", text: "Milk", status: "open", icon: "🥛" }]
          };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool)).post("/api/lists/list-1/entries").send({
      text: "Milk",
      icon: "🥛"
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.entry.status, "open");
    assert.equal(response.body.entry.icon, "🥛");
    assert.equal(callCount, 2);
  });

  it("creates the entry without writing autocomplete history", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /INSERT INTO entries \(list_id, text, status, icon\)/);
          assert.deepEqual(params, ["list-1", "Milk", null]);

          return {
            rows: [{ id: "entry-1", list_id: "list-1", text: "Milk", status: "open", icon: null }]
          };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool)).post("/api/lists/list-1/entries").send({
      text: "Milk"
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.entry.id, "entry-1");
    assert.equal(callCount, 2);
  });

  it("writes autocomplete history when an entry is marked done", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /UPDATE entries/);
          assert.deepEqual(params, ["Oat milk", "done", null, "entry-1", "list-1"]);

          return {
            rows: [{ id: "entry-1", list_id: "list-1", text: "Oat milk", status: "done", icon: null }]
          };
        }

        assert.match(sql, /INSERT INTO autocomplete_history/);
        assert.match(sql, /ON CONFLICT \(user_id, list_id, text\)/);
        assert.match(sql, /use_count\s*=\s*autocomplete_history\.use_count \+ 1/);
        assert.deepEqual(params, ["user-1", "list-1", "Oat milk", null]);

        return { rows: [] };
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
    assert.equal(callCount, 3);
  });

  it("does not write autocomplete history when the entry stays open", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /UPDATE entries/);
          assert.deepEqual(params, ["Oat milk", "open", null, "entry-1", "list-1"]);

          return {
            rows: [{ id: "entry-1", list_id: "list-1", text: "Oat milk", status: "open", icon: null }]
          };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool))
      .patch("/api/lists/list-1/entries/entry-1")
      .send({
        text: "Oat milk",
        status: "open"
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.entry.status, "open");
    assert.equal(callCount, 2);
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
    assert.equal(callCount, 2);
  });

  it("writes autocomplete history when an entry is deleted", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /SELECT text, icon/);
          assert.deepEqual(params, ["entry-1", "list-1"]);

          return { rows: [{ text: "Milk", icon: "🥛" }] };
        }

        if (callCount === 3) {
          assert.match(sql, /DELETE FROM entries/);
          assert.deepEqual(params, ["entry-1", "list-1"]);

          return { rows: [{ id: "entry-1" }] };
        }

        assert.match(sql, /INSERT INTO autocomplete_history/);
        assert.deepEqual(params, ["user-1", "list-1", "Milk", "🥛"]);

        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool)).delete("/api/lists/list-1/entries/entry-1");

    assert.equal(response.status, 204);
    assert.equal(callCount, 4);
  });
});
