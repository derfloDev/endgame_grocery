import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";
import { withTransactions } from "./testHelpers.js";

function createAuthedApp(pool, options = {}) {
  return createApp({
    pool: withTransactions(pool),
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
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        assert.match(sql, /SELECT\s+e\.id,\s+e\.list_id,\s+e\.text,\s+e\.status,\s+e\.icon,\s+e\.details,\s+e\.created_at,\s+e\.updated_at,\s+e\.last_updated_by,/);
        assert.match(sql, /LEFT JOIN list_views lv/);
        assert.match(sql, /lv\.last_viewed_at IS NOT NULL/);
        assert.match(sql, /AS is_changed/);
        assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001", "user-1"]);

        return {
          rows: [
            {
              id: "20000000-0000-4000-8000-000000000001",
              list_id: "10000000-0000-4000-8000-000000000001",
              text: "Milk",
              status: "open",
              icon: "🥛",
              details: "2L",
              is_changed: true
            },
            {
              id: "20000000-0000-4000-8000-000000000002",
              list_id: "10000000-0000-4000-8000-000000000001",
              text: "Bread",
              status: "done",
              icon: null,
              details: null,
              is_changed: false
            }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/lists/10000000-0000-4000-8000-000000000001/entries");

    assert.equal(response.status, 200);
    assert.equal(response.body.entries.length, 2);
    assert.deepEqual(response.body.entries, [
      { id: "20000000-0000-4000-8000-000000000001", list_id: "10000000-0000-4000-8000-000000000001", text: "Milk", status: "open", icon: "🥛", details: "2L", is_changed: true },
      { id: "20000000-0000-4000-8000-000000000002", list_id: "10000000-0000-4000-8000-000000000001", text: "Bread", status: "done", icon: null, details: null, is_changed: false }
    ]);
  });

  it("creates an entry with an icon for an accessible list", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /SELECT 1 FROM lists WHERE id = \$1 FOR UPDATE/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001"]);
          return { rows: [{}] };
        }

        if (callCount === 3) {
          assert.match(sql, /SELECT COUNT\(\*\) AS cnt\s+FROM entries\s+WHERE list_id = \$1 AND status = 'open'/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001"]);
          return { rows: [{ cnt: "999" }] };
        }

        if (callCount === 4) {
          assert.match(sql, /INSERT INTO entries \(list_id, text, status, icon, details, last_updated_by\)/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001", "Milk", "🥛", null, "user-1"]);

          return {
            rows: [
              {
                id: "20000000-0000-4000-8000-000000000001",
                list_id: "10000000-0000-4000-8000-000000000001",
                text: "Milk",
                status: "open",
                icon: "🥛",
                details: null
              }
            ]
          };
        }

        if (callCount === 5) {
          assert.match(sql, /INSERT INTO pending_push_jobs[\s\S]+ON CONFLICT/);
          assert.deepEqual(params.slice(0, 2), ["10000000-0000-4000-8000-000000000001", "user-1"]);
          assert.equal(params[2] instanceof Date, true);
          assert.equal(params[3], '["Milk"]');
          return { rows: [{ item_count: 1 }] };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager }))
      .post("/api/lists/10000000-0000-4000-8000-000000000001/entries")
      .send({
      text: "Milk",
      icon: "🥛"
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.entry.status, "open");
    assert.equal(response.body.entry.icon, "🥛");
    await waitForQueuedPushInsert();
    assert.equal(callCount, 5);
    assert.deepEqual(sseManager.calls, [
      ["10000000-0000-4000-8000-000000000001", "entry:created", { listId: "10000000-0000-4000-8000-000000000001", entryId: "20000000-0000-4000-8000-000000000001" }]
    ]);
  });

  it("creates the entry without writing autocomplete history and still queues push delivery", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /SELECT 1 FROM lists WHERE id = \$1 FOR UPDATE/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001"]);
          return { rows: [{}] };
        }

        if (callCount === 3) {
          assert.match(sql, /SELECT COUNT\(\*\) AS cnt\s+FROM entries\s+WHERE list_id = \$1 AND status = 'open'/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001"]);
          return { rows: [{ cnt: "999" }] };
        }

        if (callCount === 4) {
          assert.match(sql, /INSERT INTO entries \(list_id, text, status, icon, details, last_updated_by\)/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001", "Milk", null, null, "user-1"]);

          return {
            rows: [{ id: "20000000-0000-4000-8000-000000000001", list_id: "10000000-0000-4000-8000-000000000001", text: "Milk", status: "open", icon: null, details: null }]
          };
        }

        if (callCount === 5) {
          assert.match(sql, /INSERT INTO pending_push_jobs[\s\S]+ON CONFLICT/);
          assert.deepEqual(params.slice(0, 2), ["10000000-0000-4000-8000-000000000001", "user-1"]);
          assert.equal(params[2] instanceof Date, true);
          assert.equal(params[3], '["Milk"]');
          return { rows: [{ item_count: 1 }] };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool)).post("/api/lists/10000000-0000-4000-8000-000000000001/entries").send({
      text: "Milk"
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.entry.id, "20000000-0000-4000-8000-000000000001");
    await waitForQueuedPushInsert();
    assert.equal(callCount, 5);
  });

  it("stores and returns entry details on create", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /SELECT 1 FROM lists WHERE id = \$1 FOR UPDATE/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001"]);
          return { rows: [{}] };
        }

        if (callCount === 3) {
          assert.match(sql, /SELECT COUNT\(\*\) AS cnt\s+FROM entries\s+WHERE list_id = \$1 AND status = 'open'/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001"]);
          return { rows: [{ cnt: "999" }] };
        }

        if (callCount === 4) {
          assert.match(sql, /INSERT INTO entries \(list_id, text, status, icon, details, last_updated_by\)/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001", "Milk", "🥛", "2L", "user-1"]);

          return {
            rows: [
              {
                id: "20000000-0000-4000-8000-000000000001",
                list_id: "10000000-0000-4000-8000-000000000001",
                text: "Milk",
                status: "open",
                icon: "🥛",
                details: "2L"
              }
            ]
          };
        }

        if (callCount === 5) {
          assert.match(sql, /INSERT INTO pending_push_jobs[\s\S]+ON CONFLICT/);
          assert.deepEqual(params.slice(0, 2), ["10000000-0000-4000-8000-000000000001", "user-1"]);
          assert.equal(params[2] instanceof Date, true);
          assert.equal(params[3], '["Milk"]');
          return { rows: [{ item_count: 1 }] };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool)).post("/api/lists/10000000-0000-4000-8000-000000000001/entries").send({
      text: "Milk",
      icon: "🥛",
      details: " 2L "
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body.entry, {
      id: "20000000-0000-4000-8000-000000000001",
      list_id: "10000000-0000-4000-8000-000000000001",
      text: "Milk",
      status: "open",
      icon: "🥛",
      details: "2L"
    });
    await waitForQueuedPushInsert();
    assert.equal(callCount, 5);
  });

  it("rejects entry creation when the list already has 1000 open entries", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /SELECT 1 FROM lists WHERE id = \$1 FOR UPDATE/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001"]);
          return { rows: [{}] };
        }

        if (callCount === 3) {
          assert.match(sql, /SELECT COUNT\(\*\) AS cnt\s+FROM entries\s+WHERE list_id = \$1 AND status = 'open'/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001"]);
          return { rows: [{ cnt: "1000" }] };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool)).post("/api/lists/10000000-0000-4000-8000-000000000001/entries").send({
      text: "Milk"
    });

    assert.equal(response.status, 422);
    assert.match(response.body.error, /maximum of 1,000 open entries/);
    assert.equal(callCount, 3);
  });

  it("marks an entry done without writing autocomplete history", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /SELECT 1 FROM lists WHERE id = \$1 FOR UPDATE/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001"]);
          return { rows: [{}] };
        }

        if (callCount === 3) {
          assert.match(sql, /SELECT status FROM entries WHERE id = \$1 AND list_id = \$2 FOR UPDATE/);
          assert.deepEqual(params, ["20000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000001"]);
          return { rows: [{ status: "open" }] };
        }

        if (callCount === 4) {
          assert.match(sql, /SELECT COUNT\(\*\) AS cnt\s+FROM entries\s+WHERE list_id = \$1 AND status = 'done'/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001"]);
          return { rows: [{ cnt: "199" }] };
        }

        if (callCount === 5) {
          assert.match(sql, /UPDATE entries/);
          assert.match(sql, /last_updated_by = \$6/);
          assert.deepEqual(params, ["Oat milk", "done", null, false, null, "user-1", "20000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000001"]);

          return {
            rows: [
              {
                id: "20000000-0000-4000-8000-000000000001",
                list_id: "10000000-0000-4000-8000-000000000001",
                text: "Oat milk",
                status: "done",
                icon: null,
                details: "Barista"
              }
            ]
          };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager }))
      .patch("/api/lists/10000000-0000-4000-8000-000000000001/entries/20000000-0000-4000-8000-000000000001")
      .send({
        text: "Oat milk",
        status: "done"
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.entry.text, "Oat milk");
    assert.equal(response.body.entry.status, "done");
    assert.equal(response.body.entry.details, "Barista");
    assert.equal(callCount, 5);
    assert.deepEqual(sseManager.calls, [
      ["10000000-0000-4000-8000-000000000001", "entry:updated", { listId: "10000000-0000-4000-8000-000000000001", entryId: "20000000-0000-4000-8000-000000000001" }]
    ]);
  });

  it("evicts the oldest done entry before marking another entry done at the done-entry limit", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /SELECT 1 FROM lists WHERE id = \$1 FOR UPDATE/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001"]);
          return { rows: [{}] };
        }

        if (callCount === 3) {
          assert.match(sql, /SELECT status FROM entries WHERE id = \$1 AND list_id = \$2 FOR UPDATE/);
          assert.deepEqual(params, ["20000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000001"]);
          return { rows: [{ status: "open" }] };
        }

        if (callCount === 4) {
          assert.match(sql, /SELECT COUNT\(\*\) AS cnt\s+FROM entries\s+WHERE list_id = \$1 AND status = 'done'/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001"]);
          return { rows: [{ cnt: "200" }] };
        }

        if (callCount === 5) {
          assert.match(sql, /DELETE FROM entries/);
          assert.match(sql, /ORDER BY updated_at ASC, created_at ASC/);
          assert.deepEqual(params, ["10000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000001"]);
          return { rows: [] };
        }

        if (callCount === 6) {
          assert.match(sql, /UPDATE entries/);
          assert.deepEqual(params, ["Oat milk", "done", null, false, null, "user-1", "20000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000001"]);

          return {
            rows: [
              {
                id: "20000000-0000-4000-8000-000000000001",
                list_id: "10000000-0000-4000-8000-000000000001",
                text: "Oat milk",
                status: "done",
                icon: null,
                details: null
              }
            ]
          };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager }))
      .patch("/api/lists/10000000-0000-4000-8000-000000000001/entries/20000000-0000-4000-8000-000000000001")
      .send({
        text: "Oat milk",
        status: "done"
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.entry.status, "done");
    assert.equal(callCount, 6);
    assert.deepEqual(sseManager.calls, [
      ["10000000-0000-4000-8000-000000000001", "entry:updated", { listId: "10000000-0000-4000-8000-000000000001", entryId: "20000000-0000-4000-8000-000000000001" }]
    ]);
  });

  it("does not write autocomplete history when the entry stays open", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /UPDATE entries/);
          assert.deepEqual(params, ["Oat milk", "open", null, false, null, "user-1", "20000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000001"]);

          return {
            rows: [{ id: "20000000-0000-4000-8000-000000000001", list_id: "10000000-0000-4000-8000-000000000001", text: "Oat milk", status: "open", icon: null, details: null }]
          };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool))
      .patch("/api/lists/10000000-0000-4000-8000-000000000001/entries/20000000-0000-4000-8000-000000000001")
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
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        assert.match(sql, /icon = COALESCE\(\$3, icon\)/);
        assert.deepEqual(params, [null, null, "🥛", false, null, "user-1", "20000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000001"]);

        return {
          rows: [{ id: "20000000-0000-4000-8000-000000000001", list_id: "10000000-0000-4000-8000-000000000001", text: "Milk", status: "open", icon: "🥛", details: null }]
        };
      }
    };

    const response = await request(createAuthedApp(pool))
      .patch("/api/lists/10000000-0000-4000-8000-000000000001/entries/20000000-0000-4000-8000-000000000001")
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
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        assert.match(sql, /details = CASE WHEN \$4 THEN \$5 ELSE details END/);
        assert.deepEqual(params, [null, "open", null, true, "1kg", "user-1", "20000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000001"]);

        return {
          rows: [{ id: "20000000-0000-4000-8000-000000000001", list_id: "10000000-0000-4000-8000-000000000001", text: "Rice", status: "open", icon: null, details: "1kg" }]
        };
      }
    };

    const response = await request(createAuthedApp(pool))
      .patch("/api/lists/10000000-0000-4000-8000-000000000001/entries/20000000-0000-4000-8000-000000000001")
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
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        assert.deepEqual(params, ["Rice", "open", null, false, null, "user-1", "20000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000001"]);

        return {
          rows: [
            {
              id: "20000000-0000-4000-8000-000000000001",
              list_id: "10000000-0000-4000-8000-000000000001",
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
      .patch("/api/lists/10000000-0000-4000-8000-000000000001/entries/20000000-0000-4000-8000-000000000001")
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
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        assert.deepEqual(params, [null, "open", null, true, null, "user-1", "20000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000001"]);

        return {
          rows: [{ id: "20000000-0000-4000-8000-000000000001", list_id: "10000000-0000-4000-8000-000000000001", text: "Rice", status: "open", icon: null, details: null }]
        };
      }
    };

    const response = await request(createAuthedApp(pool))
      .patch("/api/lists/10000000-0000-4000-8000-000000000001/entries/20000000-0000-4000-8000-000000000001")
      .send({
        status: "open",
        details: "   "
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.entry.details, null);
    assert.equal(callCount, 2);
  });

  it("deletes an entry without writing autocomplete history", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /DELETE FROM entries/);
          assert.deepEqual(params, ["20000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000001"]);

          return { rows: [{ id: "20000000-0000-4000-8000-000000000001" }] };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager })).delete(
      "/api/lists/10000000-0000-4000-8000-000000000001/entries/20000000-0000-4000-8000-000000000001"
    );

    assert.equal(response.status, 204);
    assert.equal(callCount, 2);
    assert.deepEqual(sseManager.calls, [
      ["10000000-0000-4000-8000-000000000001", "entry:deleted", { listId: "10000000-0000-4000-8000-000000000001", entryId: "20000000-0000-4000-8000-000000000001" }]
    ]);
  });

  it("keeps delete responses successful for entries without details", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        if (callCount === 2) {
          assert.match(sql, /DELETE FROM entries/);
          assert.deepEqual(params, ["20000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000001"]);

          return { rows: [{ id: "20000000-0000-4000-8000-000000000001" }] };
        }

        assert.fail(`Unexpected query ${callCount}: ${sql}`);
      }
    };

    const response = await request(createAuthedApp(pool)).delete("/api/lists/10000000-0000-4000-8000-000000000001/entries/20000000-0000-4000-8000-000000000001");

    assert.equal(response.status, 204);
    assert.equal(callCount, 2);
  });

  it("does not broadcast create events for invalid entry requests", async () => {
    const sseManager = createSseManagerSpy();

    const response = await request(createAuthedApp(null, { sseManager }))
      .post("/api/lists/10000000-0000-4000-8000-000000000001/entries")
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
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager }))
      .patch("/api/lists/10000000-0000-4000-8000-000000000001/entries/20000000-0000-4000-8000-000000000404")
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
          return { rows: [{ id: "10000000-0000-4000-8000-000000000001" }] };
        }

        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager })).delete(
      "/api/lists/10000000-0000-4000-8000-000000000001/entries/20000000-0000-4000-8000-000000000404"
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
