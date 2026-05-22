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

        assert.match(sql, /SELECT ah\.text, ah\.icon, ah\.details, ah\.use_count/);
        assert.match(sql, /NOT EXISTS/);
        assert.match(sql, /e\.status\s*=\s*'open'/);
        assert.match(sql, /ORDER BY ah\.use_count DESC, ah\.last_used_at DESC/);
        assert.match(sql, /LIMIT 20/);
        assert.deepEqual(params, ["user-1", "list-1"]);

        return {
          rows: [
            { text: "Tomatoes", icon: "IconSalad", details: "Cherry tomatoes", use_count: 8 },
            { text: "Bread", icon: null, details: null, use_count: 4 }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/lists/list-1/history");

    assert.equal(response.status, 200);
    assert.equal(callCount, 2);
    assert.deepEqual(response.body, {
      history: [
        { text: "Tomatoes", icon: "IconSalad", details: "Cherry tomatoes", useCount: 8 },
        { text: "Bread", icon: null, details: null, useCount: 4 }
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

  it("returns 400 when the history text is blank", async () => {
    const pool = {
      async query() {
        assert.fail("pool.query should not be called for an invalid delete request");
      }
    };

    const response = await request(createAuthedApp(pool))
      .delete("/api/lists/list-1/history")
      .send({ text: "   " });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "History text is required.");
  });

  it("returns 403 when deleting history from an inaccessible list", async () => {
    const pool = {
      async query(sql, params) {
        assert.match(sql, /SELECT l.id/);
        assert.deepEqual(params, ["list-1", "user-1"]);

        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool))
      .delete("/api/lists/list-1/history")
      .send({ text: "Milk" });

    assert.equal(response.status, 403);
    assert.equal(response.body.error, "You do not have access to this list.");
  });

  it("deletes a history record for an accessible list", async () => {
    let callCount = 0;
    const pool = {
      async query(sql, params) {
        callCount += 1;

        if (callCount === 1) {
          assert.match(sql, /SELECT l.id/);
          assert.deepEqual(params, ["list-1", "user-1"]);

          return { rows: [{ id: "list-1" }] };
        }

        assert.match(sql, /DELETE FROM autocomplete_history/);
        assert.deepEqual(params, ["user-1", "list-1", "Milk"]);

        return { rowCount: 1, rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool))
      .delete("/api/lists/list-1/history")
      .send({ text: "Milk" });

    assert.equal(response.status, 204);
    assert.equal(callCount, 2);
  });
});
