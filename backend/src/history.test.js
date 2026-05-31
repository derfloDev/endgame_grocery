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

describe("history routes", () => {
  it("requires authentication", async () => {
    const pool = {
      async query() {
        assert.fail("pool.query should not be called when auth is missing");
      }
    };

    const response = await request(createApp({ pool })).get("/api/lists/list-1/history");

    assert.equal(response.status, 401);
  });

  it("returns 403 when the caller cannot access the list", async () => {
    const pool = {
      async query(sql, params) {
        assert.match(sql, /SELECT l.id/);
        assert.deepEqual(params, ["list-1", "user-1"]);

        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/lists/list-1/history");

    assert.equal(response.status, 403);
    assert.equal(response.body.error, "You do not have access to this list.");
  });

  it("returns filtered recently used items in ranked order", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          assert.match(sql, /SELECT l.id/);
          assert.deepEqual(params, ["list-1", "user-1"]);

          return { rows: [{ id: "list-1" }] };
        }

        assert.match(sql, /FROM entries/);
        assert.match(sql, /status = 'done'/);
        assert.match(sql, /NOT EXISTS/);
        assert.match(sql, /e2\.status\s*=\s*'open'/);
        assert.match(sql, /ORDER BY updated_at DESC/);
        assert.match(sql, /LIMIT 20/);
        assert.deepEqual(params, ["list-1"]);

        return {
          rows: [
            { text: "Tomatoes", icon: "IconSalad", details: "Cherry tomatoes" },
            { text: "Bread", icon: null, details: null }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/lists/list-1/history");

    assert.equal(response.status, 200);
    assert.equal(callCount, 2);
    assert.deepEqual(response.body, {
      history: [
        { text: "Tomatoes", icon: "IconSalad", details: "Cherry tomatoes" },
        { text: "Bread", icon: null, details: null }
      ]
    });
  });

  it("returns an empty history array when nothing matches", async () => {
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

    const response = await request(createAuthedApp(pool)).get("/api/lists/list-1/history");

    assert.equal(response.status, 200);
    assert.equal(callCount, 2);
    assert.deepEqual(response.body, { history: [] });
  });

  it("deletes all done entries with the requested text", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          assert.match(sql, /SELECT l.id/);
          assert.deepEqual(params, ["list-1", "user-1"]);

          return { rows: [{ id: "list-1" }] };
        }

        assert.match(sql, /DELETE FROM entries/);
        assert.match(sql, /status = 'done'/);
        assert.deepEqual(params, ["list-1", "Milk"]);

        return { rowCount: 2, rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool))
      .delete("/api/lists/list-1/history")
      .send({ text: "Milk" });

    assert.equal(response.status, 204);
    assert.equal(callCount, 2);
  });

  it("returns 204 when the requested history item does not exist", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return { rows: [{ id: "list-1" }] };
        }

        return { rowCount: 0, rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool))
      .delete("/api/lists/list-1/history")
      .send({ text: "Missing item" });

    assert.equal(response.status, 204);
    assert.equal(callCount, 2);
  });

  it("does not delete open entries with the same text", async () => {
    let deleteSql = "";
    const pool = {
      async query(sql) {
        if (!deleteSql) {
          deleteSql = sql;
          return { rows: [{ id: "list-1" }] };
        }

        deleteSql = sql;
        return { rowCount: 1, rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool))
      .delete("/api/lists/list-1/history")
      .send({ text: "Bread" });

    assert.equal(response.status, 204);
    assert.match(deleteSql, /status = 'done'/);
    assert.doesNotMatch(deleteSql, /status <> 'open'/);
  });
});
