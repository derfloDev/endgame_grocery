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

describe("entry routes", () => {
  it("returns entries with icon values for accessible lists", async () => {
    let callCount = 0;
    const pool = {
      async query(sql) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        assert.match(sql, /SELECT id, list_id, text, status, icon, details, created_at, updated_at/);

        return {
          rows: [
            {
              id: "entry-1",
              list_id: "list-1",
              text: "Milk",
              status: "open",
              icon: "🥛",
              details: "2L"
            },
            {
              id: "entry-2",
              list_id: "list-1",
              text: "Bread",
              status: "done",
              icon: null,
              details: null
            }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/lists/list-1/entries");

    assert.equal(response.status, 200);
    assert.equal(response.body.entries.length, 2);
    assert.deepEqual(response.body.entries, [
      { id: "entry-1", list_id: "list-1", text: "Milk", status: "open", icon: "🥛", details: "2L" },
      { id: "entry-2", list_id: "list-1", text: "Bread", status: "done", icon: null, details: null }
    ]);
  });

  it("creates an entry with an icon for an accessible list", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /INSERT INTO entries \(list_id, text, status, icon, details\)/);
          assert.deepEqual(params, ["list-1", "Milk", "🥛", null]);

          return {
            rows: [
              {
                id: "entry-1",
                list_id: "list-1",
                text: "Milk",
                status: "open",
                icon: "🥛",
                details: null
              }
            ]
          };
        }

        if (callCount === 3) {
          assert.match(sql, /SELECT id, items, fire_at\s+FROM pending_push_jobs/);
          assert.deepEqual(params, ["list-1", "user-1"]);
          return { rows: [] };
        }

        if (callCount === 4) {
          assert.match(sql, /INSERT INTO pending_push_jobs/);
          assert.deepEqual(params, ["list-1", "user-1", params[2], ["Milk"]]);
          assert.equal(params[2] instanceof Date, true);
          return { rows: [] };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager }))
      .post("/api/lists/list-1/entries")
      .send({
      text: "Milk",
      icon: "🥛"
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.entry.status, "open");
    assert.equal(response.body.entry.icon, "🥛");
    await waitForQueuedPushInsert();
    assert.equal(callCount, 4);
    assert.deepEqual(sseManager.calls, [
      ["list-1", "entry:created", { listId: "list-1", entryId: "entry-1" }]
    ]);
  });

  it("creates the entry without writing autocomplete history and still queues push delivery", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /INSERT INTO entries \(list_id, text, status, icon, details\)/);
          assert.deepEqual(params, ["list-1", "Milk", null, null]);

          return {
            rows: [{ id: "entry-1", list_id: "list-1", text: "Milk", status: "open", icon: null, details: null }]
          };
        }

        if (callCount === 3) {
          assert.match(sql, /SELECT id, items, fire_at\s+FROM pending_push_jobs/);
          return { rows: [] };
        }

        if (callCount === 4) {
          assert.match(sql, /INSERT INTO pending_push_jobs/);
          assert.deepEqual(params, ["list-1", "user-1", params[2], ["Milk"]]);
          assert.equal(params[2] instanceof Date, true);
          return { rows: [] };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool)).post("/api/lists/list-1/entries").send({
      text: "Milk"
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.entry.id, "entry-1");
    await waitForQueuedPushInsert();
    assert.equal(callCount, 4);
  });

  it("stores and returns entry details on create", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /INSERT INTO entries \(list_id, text, status, icon, details\)/);
          assert.deepEqual(params, ["list-1", "Milk", "🥛", "2L"]);

          return {
            rows: [
              {
                id: "entry-1",
                list_id: "list-1",
                text: "Milk",
                status: "open",
                icon: "🥛",
                details: "2L"
              }
            ]
          };
        }

        if (callCount === 3) {
          assert.match(sql, /SELECT id, items, fire_at\s+FROM pending_push_jobs/);
          return { rows: [] };
        }

        if (callCount === 4) {
          assert.match(sql, /INSERT INTO pending_push_jobs/);
          assert.deepEqual(params, ["list-1", "user-1", params[2], ["Milk"]]);
          assert.equal(params[2] instanceof Date, true);
          return { rows: [] };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool)).post("/api/lists/list-1/entries").send({
      text: "Milk",
      icon: "🥛",
      details: " 2L "
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body.entry, {
      id: "entry-1",
      list_id: "list-1",
      text: "Milk",
      status: "open",
      icon: "🥛",
      details: "2L"
    });
    await waitForQueuedPushInsert();
    assert.equal(callCount, 4);
  });

  it("writes autocomplete history when an entry is marked done", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /UPDATE entries/);
          assert.deepEqual(params, ["Oat milk", "done", null, false, null, "entry-1", "list-1"]);

          return {
            rows: [
              {
                id: "entry-1",
                list_id: "list-1",
                text: "Oat milk",
                status: "done",
                icon: null,
                details: "Barista"
              }
            ]
          };
        }

        assert.match(sql, /INSERT INTO autocomplete_history/);
        assert.match(sql, /ON CONFLICT \(user_id, list_id, text\)/);
        assert.match(sql, /use_count\s*=\s*autocomplete_history\.use_count \+ 1/);
        assert.deepEqual(params, ["user-1", "list-1", "Oat milk", null]);

        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager }))
      .patch("/api/lists/list-1/entries/entry-1")
      .send({
        text: "Oat milk",
        status: "done"
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.entry.text, "Oat milk");
    assert.equal(response.body.entry.status, "done");
    assert.equal(response.body.entry.details, "Barista");
    assert.equal(callCount, 3);
    assert.deepEqual(sseManager.calls, [
      ["list-1", "entry:updated", { listId: "list-1", entryId: "entry-1" }]
    ]);
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
          assert.deepEqual(params, ["Oat milk", "open", null, false, null, "entry-1", "list-1"]);

          return {
            rows: [{ id: "entry-1", list_id: "list-1", text: "Oat milk", status: "open", icon: null, details: null }]
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
        assert.deepEqual(params, [null, null, "🥛", false, null, "entry-1", "list-1"]);

        return {
          rows: [{ id: "entry-1", list_id: "list-1", text: "Milk", status: "open", icon: "🥛", details: null }]
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

  it("updates entry details when the details field is present", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        assert.match(sql, /details = CASE WHEN \$4 THEN \$5 ELSE details END/);
        assert.deepEqual(params, [null, "open", null, true, "1kg", "entry-1", "list-1"]);

        return {
          rows: [{ id: "entry-1", list_id: "list-1", text: "Rice", status: "open", icon: null, details: "1kg" }]
        };
      }
    };

    const response = await request(createAuthedApp(pool))
      .patch("/api/lists/list-1/entries/entry-1")
      .send({
        status: "open",
        details: " 1kg "
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.entry.details, "1kg");
    assert.equal(callCount, 2);
  });

  it("preserves entry details when the details field is absent", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        assert.deepEqual(params, ["Rice", "open", null, false, null, "entry-1", "list-1"]);

        return {
          rows: [
            {
              id: "entry-1",
              list_id: "list-1",
              text: "Rice",
              status: "open",
              icon: null,
              details: "keep existing"
            }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool))
      .patch("/api/lists/list-1/entries/entry-1")
      .send({
        text: "Rice",
        status: "open"
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.entry.details, "keep existing");
    assert.equal(callCount, 2);
  });

  it("clears entry details when the details field is blank", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        assert.deepEqual(params, [null, "open", null, true, null, "entry-1", "list-1"]);

        return {
          rows: [{ id: "entry-1", list_id: "list-1", text: "Rice", status: "open", icon: null, details: null }]
        };
      }
    };

    const response = await request(createAuthedApp(pool))
      .patch("/api/lists/list-1/entries/entry-1")
      .send({
        status: "open",
        details: "   "
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.entry.details, null);
    assert.equal(callCount, 2);
  });

  it("writes autocomplete history when an entry is deleted", async () => {
    const sseManager = createSseManagerSpy();
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

    const response = await request(createAuthedApp(pool, { sseManager })).delete(
      "/api/lists/list-1/entries/entry-1"
    );

    assert.equal(response.status, 204);
    assert.equal(callCount, 4);
    assert.deepEqual(sseManager.calls, [
      ["list-1", "entry:deleted", { listId: "list-1", entryId: "entry-1" }]
    ]);
  });

  it("does not broadcast create events for invalid entry requests", async () => {
    const sseManager = createSseManagerSpy();

    const response = await request(createAuthedApp(null, { sseManager }))
      .post("/api/lists/list-1/entries")
      .send({});

    assert.equal(response.status, 400);
    assert.deepEqual(sseManager.calls, []);
  });

  it("does not broadcast update events when the entry is missing", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager }))
      .patch("/api/lists/list-1/entries/entry-404")
      .send({ text: "Milk" });

    assert.equal(response.status, 404);
    assert.deepEqual(sseManager.calls, []);
  });

  it("does not broadcast delete events when the entry is missing", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager })).delete(
      "/api/lists/list-1/entries/entry-404"
    );

    assert.equal(response.status, 404);
    assert.deepEqual(sseManager.calls, []);
  });
});

async function waitForQueuedPushInsert() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

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
