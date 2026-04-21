import { describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "./app.js";
import { createRequireAuth } from "./middleware/auth.js";

describe("authentication routes", () => {
  it("registers a user and returns 201", async () => {
    const pool = {
      async query() {
        return {
          rows: [
            {
              id: "user-1",
              email: "demo@example.com",
              display_name: "Demo User",
              created_at: "2026-04-21T00:00:00Z"
            }
          ]
        };
      }
    };

    const app = createApp({ pool });

    const response = await request(app).post("/api/auth/register").send({
      email: "demo@example.com",
      password: "password123",
      display_name: "Demo User"
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.user.email, "demo@example.com");
  });

  it("logs in an existing user and returns a token", async () => {
    const passwordHash = await bcrypt.hash("password123", 12);
    const pool = {
      async query() {
        return {
          rows: [
            {
              id: "user-1",
              email: "demo@example.com",
              display_name: "Demo User",
              password_hash: passwordHash
            }
          ]
        };
      }
    };

    const app = createApp({
      pool,
      config: {
        jwtSecret: "test-secret",
        jwtExpiresIn: "7d"
      }
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "demo@example.com",
      password: "password123"
    });

    assert.equal(response.status, 200);
    assert.equal(typeof response.body.token, "string");
  });
});

describe("requireAuth middleware", () => {
  it("returns 401 when the bearer token is missing", async () => {
    const middleware = createRequireAuth({
      jwtLib: {
        verify() {
          throw new Error("should not be called");
        }
      },
      config: {
        jwtSecret: "test-secret"
      }
    });

    const req = { headers: {} };
    const res = createResponse();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "Authentication token is required.");
    assert.equal(nextCalled, false);
  });

  it("attaches the decoded JWT payload", () => {
    const middleware = createRequireAuth({
      jwtLib: {
        verify(token, secret) {
          assert.equal(token, "valid-token");
          assert.equal(secret, "test-secret");
          return { sub: "user-1" };
        }
      },
      config: {
        jwtSecret: "test-secret"
      }
    });

    const req = {
      headers: {
        authorization: "Bearer valid-token"
      }
    };
    const res = createResponse();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.deepEqual(req.user, { sub: "user-1" });
    assert.equal(nextCalled, true);
  });
});

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}
