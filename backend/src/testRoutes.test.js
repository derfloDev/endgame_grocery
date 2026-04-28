import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("test routes", () => {
  it("creates a verified user and returns a jwt outside production", async () => {
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

    process.env.NODE_ENV = "test";

    const app = createApp({
      pool,
      config: {
        jwtSecret: "test-secret",
        jwtExpiresIn: "7d"
      }
    });

    const response = await request(app).post("/api/test/create-verified-user").send({
      email: "demo@example.com",
      password: "password123",
      display_name: "Demo User"
    });

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

  it("returns 404 for test routes in production", async () => {
    process.env.NODE_ENV = "production";

    const response = await request(createApp({})).post("/api/test/create-verified-user").send({
      email: "demo@example.com",
      password: "password123",
      display_name: "Demo User"
    });

    assert.equal(response.status, 404);
  });
});

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}
