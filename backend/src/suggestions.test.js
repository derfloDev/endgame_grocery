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

describe("suggestion routes", () => {
  it("requires authentication", async () => {
    const pool = {
      async query() {
        assert.fail("pool.query should not be called when auth is missing");
      }
    };

    const response = await request(createApp({ pool })).get("/api/lists/list-1/suggestions?q=to");

    assert.equal(response.status, 401);
  });

  it("returns 400 when the query is shorter than two characters", async () => {
    const pool = {
      async query() {
        assert.fail("pool.query should not be called for an invalid query");
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/lists/list-1/suggestions?q=a");

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "Suggestion query must be at least 2 characters.");
  });

  it("returns 403 when the caller cannot access the list", async () => {
    const pool = {
      async query(sql, params) {
        assert.match(sql, /SELECT l.id/);
        assert.deepEqual(params, ["list-1", "user-1"]);

        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/lists/list-1/suggestions?q=to");

    assert.equal(response.status, 403);
    assert.equal(response.body.error, "You do not have access to this list.");
  });

  it("returns ranked typo-tolerant suggestions for accessible lists", async () => {
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
        assert.match(sql, /GROUP BY text/);
        assert.match(sql, /text ILIKE \$2/);
        assert.match(sql, /similarity\(text, \$3\) > 0\.25/);
        assert.match(sql, /ORDER BY use_count DESC, max\(updated_at\) DESC/);
        assert.match(sql, /LIMIT 5/);
        assert.deepEqual(params, ["list-1", "%Schokollade%", "Schokollade"]);

        return {
          rows: [
            { text: "Schokolade", icon: "IconCandy", use_count: 7 },
            { text: "Schoko Cookies", icon: "IconCookie", use_count: 3 }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).get(
      "/api/lists/list-1/suggestions?q=Schokollade"
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      suggestions: [
        { text: "Schokolade", icon: "IconCandy", useCount: 7 },
        { text: "Schoko Cookies", icon: "IconCookie", useCount: 3 }
      ]
    });
  });

  it("returns an empty suggestions array when there are no matches", async () => {
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

    const response = await request(createAuthedApp(pool)).get("/api/lists/list-1/suggestions?q=to");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { suggestions: [] });
  });
});
