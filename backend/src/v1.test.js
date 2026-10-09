import { describe, it } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import request from "supertest";
import { createApp } from "./app.js";
import { hashToken } from "./tokens.js";

const LIST_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_LIST_ID = "22222222-2222-4222-8222-222222222222";
const FOREIGN_LIST_ID = "33333333-3333-4333-8333-333333333333";
const ITEM_ID = "44444444-4444-4444-8444-444444444444";
const SECOND_ITEM_ID = "55555555-5555-4555-8555-555555555555";
const MISSING_ITEM_ID = "66666666-6666-4666-8666-666666666666";

function createV1App(pool, options = {}) {
  return createApp({
    pool,
    logger: options.logger,
    sseManager: options.sseManager ?? createSseManagerSpy(),
    requireApiKey(req, res, next) {
      if (!req.headers["x-api-key"]) {
        res.status(401).json({ error: "API key is required." });
        return;
      }

      req.user = { sub: "user-1" };
      next();
    }
  });
}

function createAccessDeniedPool() {
  return {
    async query(sql, params) {
      assert.match(normalizeSql(sql), /FROM lists l LEFT JOIN list_members lm/);
      assert.deepEqual(params, [FOREIGN_LIST_ID, "user-1"]);
      return { rows: [] };
    }
  };
}

describe("external v1 API routes", () => {
  const endpointsRequiringApiKey = [
    ["get", "/api/v1/lists"],
    ["get", `/api/v1/lists/${LIST_ID}/items`],
    ["post", `/api/v1/lists/${LIST_ID}/items`],
    ["post", `/api/v1/lists/${LIST_ID}/items/${ITEM_ID}/toggle`],
    ["patch", `/api/v1/lists/${LIST_ID}/items/${ITEM_ID}`],
    ["delete", `/api/v1/lists/${LIST_ID}/items/${ITEM_ID}`]
  ];

  for (const [method, path] of endpointsRequiringApiKey) {
    it(`returns 401 for ${method.toUpperCase()} ${path} when the API key is missing`, async () => {
      const response = await request(createV1App(null))[method](path);

      assert.equal(response.status, 401);
      assert.deepEqual(response.body, { error: "API key is required." });
    });
  }

  it("returns 401 when the default API-key middleware rejects an unknown key", async () => {
    let queryArgs = null;
    const pool = {
      async query(sql, params) {
        queryArgs = [normalizeSql(sql), params];
        return { rows: [] };
      }
    };

    const response = await request(createApp({ pool }))
      .get("/api/v1/lists")
      .set("X-Api-Key", "40000000-0000-4000-8000-000000000007");

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Invalid API key." });
    assert.match(queryArgs[0], /SELECT id FROM users WHERE api_key_hash = \$1 LIMIT 1/);
    assert.deepEqual(queryArgs[1], [hashToken("40000000-0000-4000-8000-000000000007")]);
  });

  const listAccessEndpoints = [
    ["get", `/api/v1/lists/${FOREIGN_LIST_ID}/items`],
    ["post", `/api/v1/lists/${FOREIGN_LIST_ID}/items`],
    ["post", `/api/v1/lists/${FOREIGN_LIST_ID}/items/${ITEM_ID}/toggle`],
    ["patch", `/api/v1/lists/${FOREIGN_LIST_ID}/items/${ITEM_ID}`],
    ["delete", `/api/v1/lists/${FOREIGN_LIST_ID}/items/${ITEM_ID}`]
  ];

  for (const [method, path] of listAccessEndpoints) {
    it(`returns 403 for ${method.toUpperCase()} ${path} when the API key user cannot access the list`, async () => {
      const agent = request(createV1App(createAccessDeniedPool()));
      const body = (method === "post" && path.endsWith("/items")) || method === "patch" ? { name: "Oat milk" } : undefined;
      const response = await agent[method](path)
        .set("X-Api-Key", "valid-api-key")
        .send(body);

      assert.equal(response.status, 403);
      assert.deepEqual(response.body, { error: "You do not have access to this list." });
    });
  }

  it("returns owned and shared lists with the v1 list shape", async () => {
    let queryArgs = null;
    const pool = {
      async query(sql, params) {
        queryArgs = [normalizeSql(sql), params];
        return {
          rows: [
            { id: LIST_ID, name: "Weekly groceries" },
            { id: SECOND_LIST_ID, name: "BBQ party" }
          ]
        };
      }
    };

    const response = await request(createV1App(pool))
      .get("/api/v1/lists")
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      lists: [
        { id: LIST_ID, name: "Weekly groceries" },
        { id: SECOND_LIST_ID, name: "BBQ party" }
      ]
    });
    assert.match(queryArgs[0], /FROM lists l/);
    assert.match(queryArgs[0], /LEFT JOIN list_members lm/);
    assert.deepEqual(queryArgs[1], ["user-1"]);
  });

  it("returns list items with raw entry status values", async () => {
    const pool = createEntriesPool({
      entries: [
        { id: ITEM_ID, text: "Milk", status: "open", details: null, is_changed: false },
        { id: SECOND_ITEM_ID, text: "Bread", status: "done", details: "Sourdough", is_changed: false }
      ]
    });

    const response = await request(createV1App(pool))
      .get(`/api/v1/lists/${LIST_ID}/items`)
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      items: [
        { id: ITEM_ID, name: "Milk", status: "open", description: null },
        { id: SECOND_ITEM_ID, name: "Bread", status: "done", description: "Sourdough" }
      ]
    });
  });

  it("returns 404 for an invalid list ID when listing items", async () => {
    const pool = createUnexpectedQueryPool();

    const response = await request(createV1App(pool))
      .get("/api/v1/lists/{listId}/items")
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "List not found." });
  });

  it("returns 400 when creating an item without a name", async () => {
    const pool = {
      async query() {
        throw new Error("create query should not run for invalid input");
      }
    };

    const response = await request(createV1App(pool))
      .post(`/api/v1/lists/${LIST_ID}/items`)
      .set("X-Api-Key", "valid-api-key")
      .send({});

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "Item name is required." });
  });

  it("creates an open item, records the actor and queues a push", async () => {
    const sseManager = createSseManagerSpy();
    const pool = createEntriesPool();

    const response = await request(createV1App(pool, { sseManager }))
      .post(`/api/v1/lists/${LIST_ID}/items`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: " Milk " });

    await waitForAsyncHandlers();
    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      item: { id: ITEM_ID, name: "Milk", status: "open", description: null }
    });
    const insert = pool.find("INSERT INTO entries");
    assert.match(insert[0], /INSERT INTO entries \(list_id, text, status, icon, details, last_updated_by\)/);
    assert.deepEqual(insert[1], [LIST_ID, "Milk", null, null, "user-1"]);
    assert.deepEqual(sseManager.calls, [
      [LIST_ID, "entry:created", { listId: LIST_ID, entryId: ITEM_ID }]
    ]);
    const push = pool.find("INSERT INTO pending_push_jobs");
    assert.deepEqual(push[1].slice(0, 2), [LIST_ID, "user-1"]);
    assert.equal(push[1][3], '["Milk"]');
  });

  it("answers 422 when the list already has 1000 open items", async () => {
    const sseManager = createSseManagerSpy();
    const pool = createEntriesPool({ openCount: 1000 });

    const response = await request(createV1App(pool, { sseManager }))
      .post(`/api/v1/lists/${LIST_ID}/items`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: "Milk" });

    await waitForAsyncHandlers();
    assert.equal(response.status, 422);
    assert.match(response.body.error, /maximum of 1,000 open items/);
    assert.equal(pool.find("INSERT INTO entries"), undefined);
    assert.equal(pool.find("INSERT INTO pending_push_jobs"), undefined);
    assert.deepEqual(sseManager.calls, []);
  });

  it("creates an item with a trimmed description and turns a blank one into null", async () => {
    const pool = createEntriesPool();
    const create = (description) =>
      request(createV1App(pool))
        .post(`/api/v1/lists/${LIST_ID}/items`)
        .set("X-Api-Key", "valid-api-key")
        .send({ name: " Milk ", description });

    const withText = await create(" fresh ");
    const blank = await create("   ");

    assert.equal(withText.status, 201);
    assert.equal(withText.body.item.description, "fresh");
    assert.equal(blank.status, 201);
    assert.equal(blank.body.item.description, null);
    const inserts = pool.statements.filter(([sql]) => sql.startsWith("INSERT INTO entries"));
    assert.deepEqual(inserts.map(([, params]) => params[3]), ["fresh", null]);
  });

  it("answers 400 for a description that is not a string", async () => {
    const pool = createUnexpectedQueryPool();

    for (const description of [5, true, ["a"], { a: 1 }]) {
      const response = await request(createV1App(pool))
        .post(`/api/v1/lists/${LIST_ID}/items`)
        .set("X-Api-Key", "valid-api-key")
        .send({ name: "Milk", description });

      assert.equal(response.status, 400);
      assert.deepEqual(response.body, { error: "Item description must be a string." });
    }

    const rename = await request(createV1App(pool))
      .patch(`/api/v1/lists/${LIST_ID}/items/${ITEM_ID}`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: "Milk", description: 5 });

    assert.equal(rename.status, 400);
  });

  it("keeps create responses successful when the SSE broadcast fails", async () => {
    const { logger, getEntries } = createLogCapture();
    const sseManager = createRejectingSseManager();
    const pool = createEntriesPool();

    const response = await request(createV1App(pool, { logger, sseManager }))
      .post(`/api/v1/lists/${LIST_ID}/items`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: "Milk" });

    await waitForAsyncHandlers();
    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      item: { id: ITEM_ID, name: "Milk", status: "open", description: null }
    });
    assert.deepEqual(sseManager.calls, [
      [LIST_ID, "entry:created", { listId: LIST_ID, entryId: ITEM_ID }]
    ]);
    assert.ok(getEntries().some((entry) => entry.msg === "Failed to broadcast SSE event"));
  });

  it("returns 404 for an invalid list ID when creating an item", async () => {
    const pool = createUnexpectedQueryPool();

    const response = await request(createV1App(pool))
      .post("/api/v1/lists/{listId}/items")
      .set("X-Api-Key", "valid-api-key")
      .send({ name: "Milk" });

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "List not found." });
  });

  it("toggles an open item to done and records the actor", async () => {
    const order = [];
    const sseManager = createSseManagerSpy(() => order.push("broadcast"));
    const pool = createEntriesPool({ entry: { id: ITEM_ID, text: "Milk", status: "open", details: "2%" } });

    const response = await request(createV1App(pool, { sseManager }))
      .post(`/api/v1/lists/${LIST_ID}/items/${ITEM_ID}/toggle`)
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      item: { id: ITEM_ID, name: "Milk", status: "done", description: "2%" }
    });
    const update = pool.find("UPDATE entries");
    assert.match(update[0], /last_updated_by = \$6/);
    assert.deepEqual(update[1], [null, "done", null, false, null, "user-1", ITEM_ID, LIST_ID]);
    assert.deepEqual(sseManager.calls, [
      [LIST_ID, "entry:updated", { listId: LIST_ID, entryId: ITEM_ID }]
    ]);
    assert.deepEqual(order, ["broadcast"]);
  });

  it("evicts the oldest done item when toggling an open item to done at the done limit", async () => {
    const pool = createEntriesPool({
      entry: { id: ITEM_ID, text: "Milk", status: "open", details: null },
      doneCount: 200
    });

    const response = await request(createV1App(pool))
      .post(`/api/v1/lists/${LIST_ID}/items/${ITEM_ID}/toggle`)
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 200);
    assert.deepEqual(pool.find("DELETE FROM entries")[1], [LIST_ID, ITEM_ID]);
  });

  it("toggles a done item back to open without evicting anything", async () => {
    const sseManager = createSseManagerSpy();
    const pool = createEntriesPool({
      entry: { id: ITEM_ID, text: "Milk", status: "done", details: null },
      doneCount: 200
    });

    const response = await request(createV1App(pool, { sseManager }))
      .post(`/api/v1/lists/${LIST_ID}/items/${ITEM_ID}/toggle`)
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      item: { id: ITEM_ID, name: "Milk", status: "open", description: null }
    });
    assert.equal(pool.find("DELETE FROM entries"), undefined);
    assert.equal(pool.find("UPDATE entries")[1][1], "open");
    assert.deepEqual(sseManager.calls, [
      [LIST_ID, "entry:updated", { listId: LIST_ID, entryId: ITEM_ID }]
    ]);
  });

  it("keeps toggle responses successful when the SSE broadcast fails", async () => {
    const { logger, getEntries } = createLogCapture();
    const sseManager = createRejectingSseManager();
    const pool = createEntriesPool({ entry: { id: ITEM_ID, text: "Milk", status: "done", details: null } });

    const response = await request(createV1App(pool, { logger, sseManager }))
      .post(`/api/v1/lists/${LIST_ID}/items/${ITEM_ID}/toggle`)
      .set("X-Api-Key", "valid-api-key");

    await waitForAsyncHandlers();
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      item: { id: ITEM_ID, name: "Milk", status: "open", description: null }
    });
    assert.deepEqual(sseManager.calls, [
      [LIST_ID, "entry:updated", { listId: LIST_ID, entryId: ITEM_ID }]
    ]);
    assert.ok(getEntries().some((entry) => entry.msg === "Failed to broadcast SSE event"));
  });

  it("returns 404 for an invalid item ID when toggling an item", async () => {
    const pool = createUnexpectedQueryPool();

    const response = await request(createV1App(pool))
      .post(`/api/v1/lists/${LIST_ID}/items/{itemId}/toggle`)
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "Item not found." });
  });

  it("returns 404 when toggling an unknown item", async () => {
    const pool = createEntriesPool({ entry: null });

    const response = await request(createV1App(pool))
      .post(`/api/v1/lists/${LIST_ID}/items/${MISSING_ITEM_ID}/toggle`)
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "Item not found." });
    assert.equal(pool.find("DELETE FROM entries"), undefined);
  });

  it("returns 400 when renaming an item without a name", async () => {
    const pool = createUnexpectedQueryPool();

    const response = await request(createV1App(pool))
      .patch(`/api/v1/lists/${LIST_ID}/items/${ITEM_ID}`)
      .set("X-Api-Key", "valid-api-key")
      .send({});

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "Item name is required." });
  });

  it("returns 400 when renaming an item with a blank name", async () => {
    const pool = createUnexpectedQueryPool();

    const response = await request(createV1App(pool))
      .patch(`/api/v1/lists/${LIST_ID}/items/${ITEM_ID}`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: "  " });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "Item name is required." });
  });

  it("returns 404 for an invalid list ID when renaming an item", async () => {
    const pool = createUnexpectedQueryPool();

    const response = await request(createV1App(pool))
      .patch(`/api/v1/lists/{listId}/items/${ITEM_ID}`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: "Oat milk" });

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "List not found." });
  });

  it("returns 404 for an invalid item ID when renaming an item", async () => {
    const pool = createUnexpectedQueryPool();

    const response = await request(createV1App(pool))
      .patch(`/api/v1/lists/${LIST_ID}/items/not-a-uuid`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: "Oat milk" });

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "Item not found." });
  });

  it("returns 404 when renaming an unknown item", async () => {
    const sseManager = createSseManagerSpy();
    const pool = createEntriesPool({ entry: null });

    const response = await request(createV1App(pool, { sseManager }))
      .patch(`/api/v1/lists/${LIST_ID}/items/${MISSING_ITEM_ID}`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: "Oat milk" });

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "Item not found." });
    assert.deepEqual(pool.find("UPDATE entries")[1].slice(0, 1), ["Oat milk"]);
    assert.deepEqual(sseManager.calls, []);
  });

  it("renames an existing item and records the actor", async () => {
    const sseManager = createSseManagerSpy();
    const pool = createEntriesPool({ entry: { id: ITEM_ID, text: "Milk", status: "open", details: null } });

    const response = await request(createV1App(pool, { sseManager }))
      .patch(`/api/v1/lists/${LIST_ID}/items/${ITEM_ID}`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: " Oat milk " });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      item: { id: ITEM_ID, name: "Oat milk", status: "open", description: null }
    });
    assert.deepEqual(pool.find("UPDATE entries")[1], ["Oat milk", null, null, false, null, "user-1", ITEM_ID, LIST_ID]);
    assert.deepEqual(sseManager.calls, [
      [LIST_ID, "entry:updated", { listId: LIST_ID, entryId: ITEM_ID }]
    ]);
  });

  it("updates description when the description key is present in a patch", async () => {
    const pool = createEntriesPool({ entry: { id: ITEM_ID, text: "Milk", status: "open", details: null } });

    const response = await request(createV1App(pool))
      .patch(`/api/v1/lists/${LIST_ID}/items/${ITEM_ID}`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: " Milk ", description: " 2% " });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      item: { id: ITEM_ID, name: "Milk", status: "open", description: "2%" }
    });
    assert.deepEqual(pool.find("UPDATE entries")[1].slice(3, 5), [true, "2%"]);
  });

  it("clears description when description is null or blank in a patch", async () => {
    const pool = createEntriesPool({ entry: { id: ITEM_ID, text: "Milk", status: "open", details: "old" } });

    for (const description of [null, "   "]) {
      pool.statements.length = 0;
      const response = await request(createV1App(pool))
        .patch(`/api/v1/lists/${LIST_ID}/items/${ITEM_ID}`)
        .set("X-Api-Key", "valid-api-key")
        .send({ name: " Milk ", description });

      assert.equal(response.status, 200);
      assert.equal(response.body.item.description, null);
      assert.deepEqual(pool.find("UPDATE entries")[1].slice(3, 5), [true, null]);
    }
  });

  it("preserves description when the description key is absent from a patch", async () => {
    const pool = createEntriesPool({ entry: { id: ITEM_ID, text: "Milk", status: "open", details: "Keep chilled" } });

    const response = await request(createV1App(pool))
      .patch(`/api/v1/lists/${LIST_ID}/items/${ITEM_ID}`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: " Milk " });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      item: { id: ITEM_ID, name: "Milk", status: "open", description: "Keep chilled" }
    });
    assert.deepEqual(pool.find("UPDATE entries")[1].slice(3, 5), [false, null]);
  });

  it("deletes an existing item", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: LIST_ID }] };
        }

        assert.match(normalizeSql(sql), /DELETE FROM entries/);
        assert.deepEqual(params, [ITEM_ID, LIST_ID]);
        return { rows: [{ id: ITEM_ID }] };
      }
    };

    const response = await request(createV1App(pool, { sseManager }))
      .delete(`/api/v1/lists/${LIST_ID}/items/${ITEM_ID}`)
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 204);
    assert.equal(response.text, "");
    assert.equal(callCount, 2);
    assert.deepEqual(sseManager.calls, [
      [LIST_ID, "entry:deleted", { listId: LIST_ID, entryId: ITEM_ID }]
    ]);
  });

  it("returns 404 for an invalid item ID when deleting an item", async () => {
    const pool = createUnexpectedQueryPool();

    const response = await request(createV1App(pool))
      .delete(`/api/v1/lists/${LIST_ID}/items/not-a-uuid`)
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "Item not found." });
  });

  it("returns 404 when deleting an unknown item", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;
        return callCount === 1 ? { rows: [{ id: LIST_ID }] } : { rows: [] };
      }
    };

    const response = await request(createV1App(pool))
      .delete(`/api/v1/lists/${LIST_ID}/items/${MISSING_ITEM_ID}`)
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "Item not found." });
  });
});

/**
 * Pool fake that answers by statement shape (and supports transactions), so the tests do not
 * depend on the exact order of the service's queries. `pool.find(text)` returns the first
 * recorded statement that starts with, or contains, the given text.
 */
function createEntriesPool({ entry = null, entries = [], openCount = 0, doneCount = 0 } = {}) {
  const statements = [];
  const run = async (sql, params) => {
    const text = normalizeSql(sql);
    statements.push([text, params]);

    if (text.startsWith("SELECT l.id")) return { rows: [{ id: LIST_ID }] };
    if (text.startsWith("SELECT status FROM entries")) return { rows: entry ? [{ status: entry.status }] : [] };
    if (text.startsWith("SELECT COUNT(*)") && text.includes("status = 'open'")) return { rows: [{ cnt: String(openCount) }] };
    if (text.startsWith("SELECT COUNT(*)")) return { rows: [{ cnt: String(doneCount) }] };
    if (text.startsWith("SELECT e.id")) return { rows: entries };
    if (text.startsWith("INSERT INTO entries")) {
      return { rows: [{ id: ITEM_ID, text: params[1], status: "open", details: params[3], last_updated_by: params[4] }] };
    }
    if (text.startsWith("UPDATE entries")) {
      if (!entry) return { rows: [] };
      return {
        rows: [
          {
            ...entry,
            text: params[0] ?? entry.text,
            status: params[1] ?? entry.status,
            details: params[3] ? params[4] : entry.details,
            last_updated_by: params[5]
          }
        ]
      };
    }
    if (text.startsWith("INSERT INTO pending_push_jobs")) return { rows: [{ item_count: 1 }] };
    return { rows: [] };
  };

  return {
    statements,
    query: run,
    async connect() {
      return { query: run, release() {} };
    },
    find(text) {
      return statements.find(([sql]) => sql.startsWith(text) || sql.includes(text));
    }
  };
}

function createUnexpectedQueryPool() {
  return {
    async query() {
      throw new Error("database query should not run for invalid path parameters");
    }
  };
}

function createSseManagerSpy(onBroadcast = () => undefined) {
  return {
    calls: [],
    broadcastToList(pool, listId, eventType, data) {
      void pool;
      onBroadcast();
      this.calls.push([listId, eventType, data]);
      return Promise.resolve();
    }
  };
}

function createRejectingSseManager() {
  return {
    calls: [],
    broadcastToList(pool, listId, eventType, data) {
      void pool;
      this.calls.push([listId, eventType, data]);
      return Promise.reject(new Error("broadcast failed"));
    }
  };
}

async function waitForAsyncHandlers() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createLogCapture() {
  const lines = [];
  const logger = pino({ level: "trace", base: null }, {
    write(chunk) {
      lines.push(chunk.trim());
    }
  });

  return {
    logger,
    getEntries() {
      return lines.filter(Boolean).map((line) => JSON.parse(line));
    }
  };
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}
