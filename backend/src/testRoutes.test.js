import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";
import { getConfig } from "./env.js";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

const testUserBody = {
  email: "demo@example.com",
  password: "password123",
  display_name: "Demo User"
};

describe("test routes", () => {
  it("creates a verified user and returns a jwt when test routes are enabled", async () => {
    const queries = [];
    const pool = {
      async query(text, params) {
        queries.push([normalizeSql(text), params]);

        return {
          rows: [
            {
              id: "user-1",
              email: "demo@example.com",
              display_name: "Demo User",
              created_at: "2026-04-28T00:00:00Z"
            }
          ]
        };
      }
    };

    const app = createApp({
      pool,
      config: {
        enableTestRoutes: true,
        jwtSecret: "test-secret",
        jwtExpiresIn: "7d"
      }
    });

    const response = await request(app).post("/api/test/create-verified-user").send(testUserBody);

    assert.equal(response.status, 201);
    assert.equal(typeof response.body.token, "string");
    assert.match(queries[0][0], /INSERT INTO users/);
    assert.deepEqual(queries[0][1], [
      "demo@example.com",
      queries[0][1][1],
      "Demo User",
      true
    ]);
  });

  it("returns 404 for test routes when ENABLE_TEST_ROUTES is not set", async () => {
    process.env.NODE_ENV = "test";

    const response = await request(createApp({ config: { enableTestRoutes: false } }))
      .post("/api/test/create-verified-user")
      .send(testUserBody);

    assert.equal(response.status, 404);
  });

  it("returns 404 for test routes in development without the flag", async () => {
    process.env.NODE_ENV = "development";

    const response = await request(createApp({ config: { enableTestRoutes: false } }))
      .post("/api/test/create-verified-user")
      .send(testUserBody);

    assert.equal(response.status, 404);
  });

  it("derives enableTestRoutes from the ENABLE_TEST_ROUTES environment variable", () => {
    const previous = process.env.ENABLE_TEST_ROUTES;

    try {
      delete process.env.ENABLE_TEST_ROUTES;
      assert.equal(getConfig().enableTestRoutes, false);
      process.env.ENABLE_TEST_ROUTES = "1";
      assert.equal(getConfig().enableTestRoutes, false);
      process.env.ENABLE_TEST_ROUTES = "true";
      assert.equal(getConfig().enableTestRoutes, true);
    } finally {
      if (previous === undefined) {
        delete process.env.ENABLE_TEST_ROUTES;
      } else {
        process.env.ENABLE_TEST_ROUTES = previous;
      }
    }
  });
});

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}
