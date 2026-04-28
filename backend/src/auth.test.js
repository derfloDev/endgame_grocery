import { describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import request from "supertest";
import { createApp } from "./app.js";
import { createRequireAuth } from "./middleware/auth.js";

describe("authentication routes", () => {
  it("registers a user, creates a verification token, and sends the verification mail", async () => {
    const sentMessages = [];
    const queries = [];
    const pool = {
      async query(text, params) {
        queries.push([normalizeSql(text), params]);

        if (text.includes("INSERT INTO users")) {
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

        if (text.includes("INSERT INTO email_verification_tokens")) {
          return {
            rows: [{ token: "verification-token-1" }]
          };
        }

        return {
          rows: []
        };
      }
    };

    const app = createApp({
      pool,
      config: {
        jwtSecret: "test-secret",
        jwtExpiresIn: "7d",
        appBaseUrl: "https://app.example.com"
      },
      mailer: {
        async send(message) {
          sentMessages.push(message);
        }
      },
      generateVerificationToken() {
        return "verification-token-1";
      },
      now() {
        return new Date("2026-04-21T00:00:00Z");
      }
    });

    const response = await request(app).post("/api/auth/register").send({
      email: "demo@example.com",
      password: "password123",
      display_name: "Demo User"
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, { message: "Verification email sent." });
    assert.equal(sentMessages.length, 1);
    assert.deepEqual(sentMessages[0], {
      to: "demo@example.com",
      subject: "Bitte bestätige deine E-Mail-Adresse",
      template: "verification",
      context: {
        heading: "Willkommen bei Endgame Grocery",
        intro: "Hi Demo User,",
        body: "Bitte bestätige deine E-Mail-Adresse, damit du deine Einkaufslisten nutzen kannst.",
        ctaLabel: "E-Mail bestätigen",
        ctaUrl: "https://app.example.com/verify-email?token=verification-token-1"
      }
    });
    assert.match(queries[0][0], /INSERT INTO users/);
    assert.deepEqual(queries[0][1], [
      "demo@example.com",
      queries[0][1][1],
      "Demo User",
      false
    ]);
    assert.match(queries[1][0], /INSERT INTO email_verification_tokens/);
    assert.equal(queries[1][1][0], "user-1");
    assert.equal(queries[1][1][1], "verification-token-1");
    assert.equal(queries[1][1][2].toISOString(), "2026-04-22T00:00:00.000Z");
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
              password_hash: passwordHash,
              email_verified: true
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

  it("rejects login for an unverified account", async () => {
    const passwordHash = await bcrypt.hash("password123", 12);
    const pool = {
      async query() {
        return {
          rows: [
            {
              id: "user-1",
              email: "demo@example.com",
              display_name: "Demo User",
              password_hash: passwordHash,
              email_verified: false
            }
          ]
        };
      }
    };

    const app = createApp({ pool });

    const response = await request(app).post("/api/auth/login").send({
      email: "demo@example.com",
      password: "password123"
    });

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, {
      error: "Please verify your email before logging in."
    });
  });

  it("verifies a valid token and returns a jwt", async () => {
    let updatedUserId = null;
    let deletedToken = null;
    const pool = {
      async query(text, params) {
        if (text.includes("SELECT evt.user_id")) {
          assert.equal(params[0], "valid-token");
          assert.ok(params[1] instanceof Date);
          return {
            rows: [
              {
                user_id: "user-1",
                email: "demo@example.com",
                display_name: "Demo User"
              }
            ]
          };
        }

        if (text.includes("UPDATE users")) {
          updatedUserId = params[0];
          return { rows: [] };
        }

        if (text.includes("DELETE FROM email_verification_tokens")) {
          deletedToken = params[0];
          return { rows: [] };
        }

        throw new Error(`Unexpected query: ${text}`);
      }
    };

    const app = createApp({
      pool,
      config: {
        jwtSecret: "test-secret",
        jwtExpiresIn: "7d"
      }
    });

    const response = await request(app).get("/api/auth/verify-email").query({ token: "valid-token" });

    assert.equal(response.status, 200);
    assert.equal(typeof response.body.token, "string");
    assert.equal(updatedUserId, "user-1");
    assert.equal(deletedToken, "valid-token");
  });

  it("rejects invalid or expired verification tokens", async () => {
    const pool = {
      async query() {
        return { rows: [] };
      }
    };

    const app = createApp({ pool });

    const response = await request(app).get("/api/auth/verify-email").query({ token: "expired-token" });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      error: "Verification link is invalid or has expired."
    });
  });

  it("resends verification for an unverified account and replaces old tokens", async () => {
    const sentMessages = [];
    let deletedUserId = null;
    let insertedValues = null;
    const pool = {
      async query(text, params) {
        if (text.includes("FROM users")) {
          return {
            rows: [
              {
                id: "user-1",
                email: "demo@example.com",
                display_name: "Demo User",
                email_verified: false
              }
            ]
          };
        }

        if (text.includes("DELETE FROM email_verification_tokens")) {
          deletedUserId = params[0];
          return { rows: [] };
        }

        if (text.includes("INSERT INTO email_verification_tokens")) {
          insertedValues = params;
          return { rows: [{ token: "verification-token-2" }] };
        }

        throw new Error(`Unexpected query: ${text}`);
      }
    };

    const app = createApp({
      pool,
      config: {
        appBaseUrl: "https://app.example.com"
      },
      mailer: {
        async send(message) {
          sentMessages.push(message);
        }
      },
      generateVerificationToken() {
        return "verification-token-2";
      },
      now() {
        return new Date("2026-04-21T00:00:00Z");
      }
    });

    const response = await request(app).post("/api/auth/resend-verification").send({
      email: "demo@example.com"
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { message: "If your account is pending verification, a new email has been sent." });
    assert.equal(deletedUserId, "user-1");
    assert.deepEqual(insertedValues, [
      "user-1",
      "verification-token-2",
      new Date("2026-04-22T00:00:00.000Z")
    ]);
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].to, "demo@example.com");
    assert.equal(sentMessages[0].template, "verification");
  });

  it("always returns 200 when resending verification for an unknown email", async () => {
    let mailSent = false;
    const pool = {
      async query() {
        return { rows: [] };
      }
    };

    const app = createApp({
      pool,
      mailer: {
        async send() {
          mailSent = true;
        }
      }
    });

    const response = await request(app).post("/api/auth/resend-verification").send({
      email: "missing@example.com"
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { message: "If your account is pending verification, a new email has been sent." });
    assert.equal(mailSent, false);
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

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}
