import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";

function createV1App(pool) {
  return createApp({
    pool,
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
      assert.deepEqual(params, ["list-foreign", "user-1"]);
      return { rows: [] };
    }
  };
}

describe("external v1 API routes", () => {
  const endpointsRequiringApiKey = [
    ["get", "/api/v1/lists"],
    ["get", "/api/v1/lists/list-1/items"],
    ["post", "/api/v1/lists/list-1/items"],
    ["post", "/api/v1/lists/list-1/items/item-1/toggle"],
    ["delete", "/api/v1/lists/list-1/items/item-1"]
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
    ["get", "/api/v1/lists/list-foreign/items"],
    ["post", "/api/v1/lists/list-foreign/items"],
    ["post", "/api/v1/lists/list-foreign/items/item-1/toggle"],
    ["delete", "/api/v1/lists/list-foreign/items/item-1"]
  ];

  for (const [method, path] of listAccessEndpoints) {
    it(`returns 403 for ${method.toUpperCase()} ${path} when the API key user cannot access the list`, async () => {
      const agent = request(createV1App(createAccessDeniedPool()));
      const response = await agent[method](path)
        .set("X-Api-Key", "valid-api-key")
        .send(method === "post" && path.endsWith("/items") ? { name: "Milk" } : undefined);

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
            { id: "list-1", name: "Weekly groceries" },
            { id: "list-2", name: "BBQ party" }
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
        { id: "list-1", name: "Weekly groceries" },
        { id: "list-2", name: "BBQ party" }
      ]
    });
    assert.match(queryArgs[0], /FROM lists l/);
    assert.match(queryArgs[0], /LEFT JOIN list_members lm/);
    assert.deepEqual(queryArgs[1], ["user-1"]);
  });

  it("returns list items with Home Assistant status values", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          assert.deepEqual(params, ["list-1", "user-1"]);
          return { rows: [{ id: "list-1" }] };
        }

        assert.match(normalizeSql(sql), /SELECT id, text, status FROM entries/);
        assert.deepEqual(params, ["list-1"]);
        return {
          rows: [
            { id: "item-1", text: "Milk", status: "open" },
            { id: "item-2", text: "Bread", status: "done" }
          ]
        };
      }
    };

    const response = await request(createV1App(pool))
      .get("/api/v1/lists/list-1/items")
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      items: [
        { id: "item-1", name: "Milk", status: "needs_action" },
        { id: "item-2", name: "Bread", status: "completed" }
      ]
    });
    assert.equal(callCount, 2);
  });

  it("returns 400 when creating an item without a name", async () => {
    const pool = {
      async query() {
        throw new Error("create query should not run for invalid input");
      }
    };

    const response = await request(createV1App(pool))
      .post("/api/v1/lists/list-1/items")
      .set("X-Api-Key", "valid-api-key")
      .send({});

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "Item name is required." });
  });

  it("creates an open item and returns the Home Assistant item shape", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        assert.match(normalizeSql(sql), /INSERT INTO entries \(list_id, text, status\)/);
        assert.deepEqual(params, ["list-1", "Milk"]);
        return {
          rows: [{ id: "item-1", text: "Milk", status: "open" }]
        };
      }
    };

    const response = await request(createV1App(pool))
      .post("/api/v1/lists/list-1/items")
      .set("X-Api-Key", "valid-api-key")
      .send({ name: " Milk " });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      item: { id: "item-1", name: "Milk", status: "needs_action" }
    });
    assert.equal(callCount, 2);
  });

  it("toggles an open item to completed", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        if (callCount === 2) {
          assert.match(normalizeSql(sql), /SELECT id, text, status FROM entries/);
          assert.deepEqual(params, ["item-1", "list-1"]);
          return { rows: [{ id: "item-1", text: "Milk", status: "open" }] };
        }

        assert.match(normalizeSql(sql), /UPDATE entries SET status = \$1, updated_at = NOW\(\)/);
        assert.deepEqual(params, ["done", "item-1", "list-1"]);
        return { rows: [{ id: "item-1", text: "Milk", status: "done" }] };
      }
    };

    const response = await request(createV1App(pool))
      .post("/api/v1/lists/list-1/items/item-1/toggle")
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      item: { id: "item-1", name: "Milk", status: "completed" }
    });
    assert.equal(callCount, 3);
  });

  it("returns 404 when toggling an unknown item", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;
        return callCount === 1 ? { rows: [{ id: "list-1" }] } : { rows: [] };
      }
    };

    const response = await request(createV1App(pool))
      .post("/api/v1/lists/list-1/items/item-missing/toggle")
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "Item not found." });
  });

  it("deletes an existing item", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        assert.match(normalizeSql(sql), /DELETE FROM entries/);
        assert.deepEqual(params, ["item-1", "list-1"]);
        return { rows: [{ id: "item-1" }] };
      }
    };

    const response = await request(createV1App(pool))
      .delete("/api/v1/lists/list-1/items/item-1")
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 204);
    assert.equal(response.text, "");
    assert.equal(callCount, 2);
  });

  it("returns 404 when deleting an unknown item", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;
        return callCount === 1 ? { rows: [{ id: "list-1" }] } : { rows: [] };
      }
    };

    const response = await request(createV1App(pool))
      .delete("/api/v1/lists/list-1/items/item-missing")
      .set("X-Api-Key", "valid-api-key");

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "Item not found." });
  });
});

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}
