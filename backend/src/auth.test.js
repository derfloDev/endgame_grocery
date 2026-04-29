import { describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import pino from "pino";
import request from "supertest";
import { createApp } from "./app.js";
import { createRequireAuth } from "./middleware/auth.js";

describe("authentication routes", () => {
  it("registers a user, creates a verification token, and sends the verification mail", async () => {
    const sentMessages = [];
    const queries = [];
    const { logger, getEntries } = createLogCapture();
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
      logger,
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
    assert.deepEqual(findLogEntry(getEntries(), "User registered"), {
      email: "demo@example.com",
      inviteUsed: false,
      level: 30,
      msg: "User registered",
      time: findLogEntry(getEntries(), "User registered").time,
      userId: "user-1"
    });
  });

  it("registers a user from a valid invite, auto-verifies the account, and returns a jwt", async () => {
    const sentMessages = [];
    const queries = [];
    const sseManager = createSseManagerSpy();
    const { logger, getEntries } = createLogCapture();
    const pool = {
      async query(text, params) {
        queries.push([normalizeSql(text), params]);

        if (text.includes("FROM list_invites")) {
          return {
            rows: [
              {
                id: "invite-1",
                list_id: "list-1",
                invited_email: "demo@example.com",
                status: "pending"
              }
            ]
          };
        }

        if (text.includes("INSERT INTO users")) {
          return {
            rows: [
              {
                id: "user-9",
                email: "demo@example.com",
                display_name: "Demo User",
                created_at: "2026-04-21T00:00:00Z"
              }
            ]
          };
        }

        return { rows: [] };
      }
    };

    const app = createApp({
      logger,
      pool,
      sseManager,
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
      now() {
        return new Date("2026-04-21T00:00:00Z");
      }
    });

    const response = await request(app).post("/api/auth/register").send({
      email: "demo@example.com",
      password: "password123",
      display_name: "Demo User",
      invite_token: "invite-token-1"
    });

    assert.equal(response.status, 201);
    assert.equal(typeof response.body.token, "string");
    assert.equal(response.body.listId, "list-1");
    assert.equal(sentMessages.length, 0);
    assert.match(queries[0][0], /FROM list_invites/);
    assert.equal(queries[0][1][0], "invite-token-1");
    assert.equal(queries[0][1][1] instanceof Date, true);
    assert.match(queries[1][0], /INSERT INTO users/);
    assert.deepEqual(queries[1][1], [
      "demo@example.com",
      queries[1][1][1],
      "Demo User",
      true
    ]);
    assert.match(queries[2][0], /SELECT user_id FROM list_members/);
    assert.deepEqual(queries[2][1], ["list-1", "user-9"]);
    assert.match(queries[3][0], /INSERT INTO list_members/);
    assert.deepEqual(queries[3][1], ["list-1", "user-9"]);
    assert.match(queries[4][0], /UPDATE list_invites/);
    assert.deepEqual(queries[4][1], ["invite-1"]);
    assert.deepEqual(sseManager.calls, [
      ["list-1", "member:added", { listId: "list-1", userId: "user-9" }]
    ]);
    assert.deepEqual(findLogEntry(getEntries(), "User registered"), {
      email: "demo@example.com",
      inviteUsed: true,
      level: 30,
      msg: "User registered",
      time: findLogEntry(getEntries(), "User registered").time,
      userId: "user-9"
    });
  });

  it("falls back to the standard verification flow when the invite token is invalid", async () => {
    const sentMessages = [];
    const queries = [];
    const pool = {
      async query(text, params) {
        queries.push([normalizeSql(text), params]);

        if (text.includes("FROM list_invites")) {
          return { rows: [] };
        }

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
      display_name: "Demo User",
      invite_token: "expired-invite-token"
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, { message: "Verification email sent." });
    assert.equal(sentMessages.length, 1);
    assert.match(queries[0][0], /FROM list_invites/);
    assert.match(queries[1][0], /INSERT INTO users/);
    assert.deepEqual(queries[1][1], [
      "demo@example.com",
      queries[1][1][1],
      "Demo User",
      false
    ]);
    assert.match(queries[2][0], /INSERT INTO email_verification_tokens/);
  });

  it("logs in an existing user and returns a token", async () => {
    const passwordHash = await bcrypt.hash("password123", 12);
    const { logger, getEntries } = createLogCapture();
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
      logger,
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
    assert.deepEqual(findLogEntry(getEntries(), "User logged in"), {
      level: 30,
      msg: "User logged in",
      time: findLogEntry(getEntries(), "User logged in").time,
      userId: "user-1"
    });
  });

  it("logs invalid login attempts at warn", async () => {
    const passwordHash = await bcrypt.hash("password123", 12);
    const { logger, getEntries } = createLogCapture();
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

    const app = createApp({ logger, pool });

    const response = await request(app).post("/api/auth/login").send({
      email: "demo@example.com",
      password: "wrong-password"
    });

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Invalid email or password." });
    assert.deepEqual(findLogEntry(getEntries(), "Login failed"), {
      email: "demo@example.com",
      level: 40,
      msg: "Login failed",
      reason: "invalid_credentials",
      time: findLogEntry(getEntries(), "Login failed").time
    });
  });

  it("rejects login for an unverified account", async () => {
    const passwordHash = await bcrypt.hash("password123", 12);
    const { logger, getEntries } = createLogCapture();
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

    const app = createApp({ logger, pool });

    const response = await request(app).post("/api/auth/login").send({
      email: "demo@example.com",
      password: "password123"
    });

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, {
      error: "Please verify your email before logging in."
    });
    assert.deepEqual(findLogEntry(getEntries(), "Login blocked"), {
      email: "demo@example.com",
      level: 40,
      msg: "Login blocked",
      reason: "email_not_verified",
      time: findLogEntry(getEntries(), "Login blocked").time
    });
  });

  it("verifies a valid token and returns a jwt", async () => {
    let updatedUserId = null;
    let deletedToken = null;
    const { logger, getEntries } = createLogCapture();
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
      logger,
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
    assert.deepEqual(findLogEntry(getEntries(), "Email verified"), {
      level: 30,
      msg: "Email verified",
      time: findLogEntry(getEntries(), "Email verified").time,
      userId: "user-1"
    });
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

  it("creates a password reset token and sends a mail for a verified account", async () => {
    const sentMessages = [];
    let insertedValues = null;
    const pool = {
      async query(text, params) {
        if (text.includes("SELECT id, email, display_name, email_verified")) {
          return {
            rows: [
              {
                id: "user-1",
                email: "demo@example.com",
                display_name: "Demo User",
                email_verified: true
              }
            ]
          };
        }

        if (text.includes("INSERT INTO password_reset_tokens")) {
          insertedValues = params;
          return { rows: [{ token: "reset-token-1" }] };
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
      generatePasswordResetToken() {
        return "reset-token-1";
      },
      now() {
        return new Date("2026-04-21T00:00:00Z");
      }
    });

    const response = await request(app).post("/api/auth/forgot-password").send({
      email: "demo@example.com"
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { message: "If an account exists, you will receive an email." });
    assert.deepEqual(insertedValues, [
      "user-1",
      "reset-token-1",
      new Date("2026-04-21T01:00:00.000Z")
    ]);
    assert.deepEqual(sentMessages, [
      {
        to: "demo@example.com",
        subject: "Passwort zurücksetzen",
        template: "password-reset",
        context: {
          heading: "Passwort zurücksetzen",
          intro: "Hi Demo User,",
          body: "Nutze den Link unten, um dein Passwort zurückzusetzen. Der Link läuft in 60 Minuten ab.",
          ctaLabel: "Passwort zurücksetzen",
          ctaUrl: "https://app.example.com/reset-password?token=reset-token-1"
        }
      }
    ]);
  });

  it("returns 200 without sending mail for unknown forgot-password emails", async () => {
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

    const response = await request(app).post("/api/auth/forgot-password").send({
      email: "missing@example.com"
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { message: "If an account exists, you will receive an email." });
    assert.equal(mailSent, false);
  });

  it("rejects used or expired password reset tokens", async () => {
    const pool = {
      async query() {
        return { rows: [] };
      }
    };

    const app = createApp({ pool });

    const response = await request(app).post("/api/auth/reset-password").send({
      token: "used-token",
      password: "new-password-123"
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      error: "Password reset link is invalid or has expired."
    });
  });

  it("updates the password and marks the reset token as used", async () => {
    let updatedPasswordParams = null;
    let markedToken = null;
    const { logger, getEntries } = createLogCapture();
    const pool = {
      async query(text, params) {
        if (text.includes("SELECT prt.user_id")) {
          return {
            rows: [
              {
                user_id: "user-1"
              }
            ]
          };
        }

        if (text.includes("UPDATE users")) {
          updatedPasswordParams = params;
          return { rows: [] };
        }

        if (text.includes("UPDATE password_reset_tokens")) {
          markedToken = params[0];
          return { rows: [] };
        }

        throw new Error(`Unexpected query: ${text}`);
      }
    };

    const app = createApp({
      logger,
      pool,
      now() {
        return new Date("2026-04-21T00:00:00Z");
      }
    });

    const response = await request(app).post("/api/auth/reset-password").send({
      token: "valid-reset-token",
      password: "new-password-123"
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { message: "Password updated." });
    assert.equal(updatedPasswordParams[1], "user-1");
    assert.notEqual(updatedPasswordParams[0], "new-password-123");
    assert.equal(markedToken, "valid-reset-token");
    assert.deepEqual(findLogEntry(getEntries(), "Password reset completed"), {
      level: 30,
      msg: "Password reset completed",
      time: findLogEntry(getEntries(), "Password reset completed").time,
      userId: "user-1"
    });
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

function findLogEntry(entries, message) {
  const entry = entries.find((candidate) => candidate.msg === message);

  assert.ok(entry, `Expected log entry for "${message}"`);
  return entry;
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
