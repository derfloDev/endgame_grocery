import { describe, it } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import request from "supertest";
import { createApp } from "./app.js";

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
      .set("X-Api-Key", "unknown-api-key");

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Invalid API key." });
    assert.match(queryArgs[0], /SELECT id FROM users WHERE api_key = \$1 LIMIT 1/);
    assert.deepEqual(queryArgs[1], ["unknown-api-key"]);
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
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          assert.deepEqual(params, [LIST_ID, "user-1"]);
          return { rows: [{ id: LIST_ID }] };
        }

        assert.match(normalizeSql(sql), /SELECT id, text, status FROM entries/);
        assert.deepEqual(params, [LIST_ID]);
        return {
          rows: [
            { id: ITEM_ID, text: "Milk", status: "open" },
            { id: SECOND_ITEM_ID, text: "Bread", status: "done" }
          ]
        };
      }
    };

    const response = await request(createV1App(pool))
      .get(`/api/v1/lists/${LIST_ID}/items`)
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      items: [
        { id: ITEM_ID, name: "Milk", status: "open" },
        { id: SECOND_ITEM_ID, name: "Bread", status: "done" }
      ]
    });
    assert.equal(callCount, 2);
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

  it("creates an open item and returns the raw entry status", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: LIST_ID }] };
        }

        assert.match(normalizeSql(sql), /INSERT INTO entries \(list_id, text, status\)/);
        assert.deepEqual(params, [LIST_ID, "Milk"]);
        return {
          rows: [{ id: ITEM_ID, text: "Milk", status: "open" }]
        };
      }
    };

    const response = await request(createV1App(pool, { sseManager }))
      .post(`/api/v1/lists/${LIST_ID}/items`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: " Milk " });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      item: { id: ITEM_ID, name: "Milk", status: "open" }
    });
    assert.equal(callCount, 2);
    assert.deepEqual(sseManager.calls, [
      [LIST_ID, "entry:created", { listId: LIST_ID, entryId: ITEM_ID }]
    ]);
  });

  it("keeps create responses successful when the SSE broadcast fails", async () => {
    const { logger, getEntries } = createLogCapture();
    const sseManager = createRejectingSseManager();
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;
        return callCount === 1
          ? { rows: [{ id: LIST_ID }] }
          : { rows: [{ id: ITEM_ID, text: "Milk", status: "open" }] };
      }
    };

    const response = await request(createV1App(pool, { logger, sseManager }))
      .post(`/api/v1/lists/${LIST_ID}/items`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: "Milk" });

    await waitForAsyncHandlers();
    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      item: { id: ITEM_ID, name: "Milk", status: "open" }
    });
    assert.equal(callCount, 2);
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

  it("toggles an open item to done", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: LIST_ID }] };
        }

        if (callCount === 2) {
          assert.match(normalizeSql(sql), /SELECT id, text, status FROM entries/);
          assert.deepEqual(params, [ITEM_ID, LIST_ID]);
          return { rows: [{ id: ITEM_ID, text: "Milk", status: "open" }] };
        }

        assert.match(normalizeSql(sql), /UPDATE entries SET status = \$1, updated_at = NOW\(\)/);
        assert.deepEqual(params, ["done", ITEM_ID, LIST_ID]);
        return { rows: [{ id: ITEM_ID, text: "Milk", status: "done" }] };
      }
    };

    const response = await request(createV1App(pool, { sseManager }))
      .post(`/api/v1/lists/${LIST_ID}/items/${ITEM_ID}/toggle`)
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      item: { id: ITEM_ID, name: "Milk", status: "done" }
    });
    assert.equal(callCount, 3);
    assert.deepEqual(sseManager.calls, [
      [LIST_ID, "entry:updated", { listId: LIST_ID, entryId: ITEM_ID }]
    ]);
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
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;
        return callCount === 1 ? { rows: [{ id: LIST_ID }] } : { rows: [] };
      }
    };

    const response = await request(createV1App(pool))
      .post(`/api/v1/lists/${LIST_ID}/items/${MISSING_ITEM_ID}/toggle`)
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "Item not found." });
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
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: LIST_ID }] };
        }

        assert.match(normalizeSql(sql), /UPDATE entries SET text = \$1, updated_at = NOW\(\)/);
        assert.deepEqual(params, ["Oat milk", MISSING_ITEM_ID, LIST_ID]);
        return { rows: [] };
      }
    };

    const response = await request(createV1App(pool))
      .patch(`/api/v1/lists/${LIST_ID}/items/${MISSING_ITEM_ID}`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: "Oat milk" });

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "Item not found." });
    assert.equal(callCount, 2);
  });

  it("renames an existing item and returns the updated item", async () => {
    const sseManager = createSseManagerSpy();
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: LIST_ID }] };
        }

        assert.match(normalizeSql(sql), /UPDATE entries SET text = \$1, updated_at = NOW\(\)/);
        assert.deepEqual(params, ["Oat milk", ITEM_ID, LIST_ID]);
        return {
          rows: [{ id: ITEM_ID, text: "Oat milk", status: "open" }]
        };
      }
    };

    const response = await request(createV1App(pool, { sseManager }))
      .patch(`/api/v1/lists/${LIST_ID}/items/${ITEM_ID}`)
      .set("X-Api-Key", "valid-api-key")
      .send({ name: " Oat milk " });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      item: { id: ITEM_ID, name: "Oat milk", status: "open" }
    });
    assert.equal(callCount, 2);
    assert.deepEqual(sseManager.calls, [
      [LIST_ID, "entry:updated", { listId: LIST_ID, entryId: ITEM_ID }]
    ]);
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

function createUnexpectedQueryPool() {
  return {
    async query() {
      throw new Error("database query should not run for invalid path parameters");
    }
  };
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
