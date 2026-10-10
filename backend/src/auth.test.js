import { describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pino from "pino";
import request from "supertest";
import { createApp } from "./app.js";
import { withTransactions } from "./testHelpers.js";
import { createRequireApiKey, createRequireAuth } from "./middleware/auth.js";
import { getApiKeyHint, hashToken } from "./tokens.js";

describe("authentication routes", () => {
  it("returns 404 when registration is disabled", async () => {
    let queryCalled = false;
    const app = createApp({
      pool: {
        async query() {
          queryCalled = true;
          throw new Error("register query should not run");
        }
      },
      config: {
        registrationEnabled: false
      }
    });

    const response = await request(app).post("/api/auth/register").send({
      email: "demo@example.com",
      password: "password123",
      display_name: "Demo User"
    });

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { error: "Registration is disabled.", code: "auth.registration_disabled" });
    assert.equal(queryCalled, false);
  });

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
      pool: withTransactions(pool),
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
    // Only the hash of the token is stored; the plaintext goes into the mail.
    assert.equal(queries[1][1][1], hashToken("verification-token-1"));
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
    const run = async (text, params) => {
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

        if (text.includes("UPDATE list_invites")) {
          return { rows: [{ list_id: "list-1" }] };
        }

        if (text.includes("INSERT INTO list_members")) {
          return { rows: [{ user_id: "user-9" }] };
        }

        return { rows: [] };
    };
    const pool = {
      query: run,
      async connect() {
        return { query: run, release() {} };
      }
    };

    const app = createApp({
      logger,
      pool: withTransactions(pool),
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
      invite_token: "40000000-0000-4000-8000-000000000001"
    });

    assert.equal(response.status, 201);
    assert.equal(typeof response.body.token, "string");
    assert.equal(response.body.listId, "list-1");
    assert.deepEqual(response.body.user, {
      id: "user-9",
      email: "demo@example.com",
      display_name: "Demo User"
    });
    assert.equal(sentMessages.length, 0);
    assert.match(queries[0][0], /FROM list_invites/);
    assert.equal(queries[0][1][0], hashToken("40000000-0000-4000-8000-000000000001"));
    assert.equal(queries[0][1][1] instanceof Date, true);
    // User insert, invite claim and membership share one transaction.
    assert.equal(queries[1][0], "BEGIN");
    assert.match(queries[2][0], /INSERT INTO users/);
    assert.deepEqual(queries[2][1], [
      "demo@example.com",
      queries[2][1][1],
      "Demo User",
      true
    ]);
    assert.match(queries[3][0], /UPDATE list_invites SET status = 'accepted' WHERE id = \$1 AND status = 'pending'/);
    assert.equal(queries[3][1][0], "invite-1");
    assert.match(queries[4][0], /INSERT INTO list_members/);
    assert.deepEqual(queries[4][1], ["list-1", "user-9"]);
    assert.equal(queries[5][0], "COMMIT");
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

    it("does not auto-verify or join when the invite was sent to another email", async () => {
    const queries = [];
    const sseManager = createSseManagerSpy();
    const pool = {
      async query(text, params) {
        queries.push([normalizeSql(text), params]);

        if (text.includes("FROM list_invites")) {
          return {
            rows: [{ id: "invite-1", list_id: "list-1", invited_email: "someone-else@example.com", status: "pending" }]
          };
        }

        if (text.includes("INSERT INTO users")) {
          return {
            rows: [{ id: "user-9", email: "demo@example.com", display_name: "Demo User", created_at: "2026-04-21T00:00:00Z" }]
          };
        }

        return { rows: [] };
      }
    };
    const app = createApp({
      logger: createLogCapture().logger,
      pool: withTransactions(pool),
      sseManager,
      config: { jwtSecret: "test-secret", jwtExpiresIn: "7d", appBaseUrl: "https://app.example.com" },
      mailer: { async send() {} },
      now() {
        return new Date("2026-04-21T00:00:00Z");
      }
    });

    const response = await request(app).post("/api/auth/register").send({
      email: "demo@example.com",
      password: "password123",
      display_name: "Demo User",
      invite_token: "40000000-0000-4000-8000-000000000001"
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.listId, undefined);
    assert.equal(queries.find(([sql]) => sql.includes("INSERT INTO users"))[1][3], false);
    assert.equal(queries.some(([sql]) => sql.includes("list_members") || sql.startsWith("UPDATE list_invites")), false);
    assert.deepEqual(sseManager.calls, []);
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
      pool: withTransactions(pool),
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
      invite_token: "40000000-0000-4000-8000-000000000003"
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
      pool: withTransactions(pool),
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
    assert.deepEqual(response.body.user, {
      id: "user-1",
      email: "demo@example.com",
      display_name: "Demo User"
    });
    assert.deepEqual(findLogEntry(getEntries(), "User logged in"), {
      level: 30,
      msg: "User logged in",
      time: findLogEntry(getEntries(), "User logged in").time,
      userId: "user-1"
    });
  });

  it("returns the current auth user for a valid bearer token", async () => {
    let currentUserQuery = null;
    const token = jwt.sign({ sub: "user-1" }, "test-secret", { expiresIn: "7d" });
    const pool = {
      async query(text, params) {
        currentUserQuery = [normalizeSql(text), params];

        return {
          rows: [
            {
              id: "user-1",
              email: "demo@example.com",
              display_name: "Demo User"
            }
          ]
        };
      }
    };

    const app = createApp({
      pool: withCurrentTokenVersion(pool),
      config: {
        jwtSecret: "test-secret",
        jwtExpiresIn: "7d"
      }
    });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      id: "user-1",
      email: "demo@example.com",
      display_name: "Demo User"
    });
    assert.match(currentUserQuery[0], /SELECT id, email, display_name FROM users/);
    assert.deepEqual(currentUserQuery[1], ["user-1"]);
  });

  it("returns 401 for /me when the bearer token is missing", async () => {
    let queryCalled = false;
    const app = createApp({
      pool: {
        async query() {
          queryCalled = true;
          return { rows: [] };
        }
      }
    });

    const response = await request(app).get("/api/auth/me");

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, {
      error: "Authentication token is required.",
      code: "auth.token_required"
    });
    assert.equal(queryCalled, false);
  });

  it("returns 404 for /me when the authenticated user no longer exists", async () => {
    const token = jwt.sign({ sub: "user-missing" }, "test-secret", { expiresIn: "7d" });
    const pool = {
      async query() {
        return { rows: [] };
      }
    };

    const app = createApp({
      pool: withCurrentTokenVersion(pool),
      config: {
        jwtSecret: "test-secret",
        jwtExpiresIn: "7d"
      }
    });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      error: "User not found.",
      code: "user.not_found"
    });
  });

  it("returns null when the authenticated user has no API key", async () => {
    const token = jwt.sign({ sub: "user-1" }, "test-secret", { expiresIn: "7d" });
    let apiKeyQuery = null;
    const pool = {
      async query(text, params) {
        apiKeyQuery = [normalizeSql(text), params];
        return { rows: [{ api_key_hash: null, api_key_hint: null, api_key_created_at: null }] };
      }
    };

    const app = createApp({
      pool: withCurrentTokenVersion(pool),
      config: {
        jwtSecret: "test-secret",
        jwtExpiresIn: "7d"
      }
    });

    const response = await request(app)
      .get("/api/auth/api-key")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { has_key: false, hint: null, created_at: null });
    assert.match(apiKeyQuery[0], /SELECT api_key_hash, api_key_hint, api_key_created_at FROM users/);
    assert.deepEqual(apiKeyQuery[1], ["user-1"]);
  });

  it("never returns the API key again, only whether one exists, its hint and creation time", async () => {
    const token = jwt.sign({ sub: "user-1" }, "test-secret", { expiresIn: "7d" });
    const pool = {
      async query() {
        return {
          rows: [
            {
              api_key_hash: hashToken("11111111-1111-4111-8111-111111111111"),
              api_key_hint: "1111",
              api_key_created_at: "2026-04-21T00:00:00.000Z"
            }
          ]
        };
      }
    };

    const app = createApp({
      pool: withCurrentTokenVersion(pool),
      config: {
        jwtSecret: "test-secret",
        jwtExpiresIn: "7d"
      }
    });

    const response = await request(app)
      .get("/api/auth/api-key")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      has_key: true,
      hint: "1111",
      created_at: "2026-04-21T00:00:00.000Z"
    });
    assert.equal(JSON.stringify(response.body).includes("11111111-1111-4111-8111-111111111111"), false);
  });

  it("generates an API key for the authenticated user", async () => {
    const token = jwt.sign({ sub: "user-1" }, "test-secret", { expiresIn: "7d" });
    let updateQuery = null;
    const pool = {
      async query(text, params) {
        updateQuery = [normalizeSql(text), params];
        return { rows: [{ api_key_hint: params[1], api_key_created_at: params[2] }] };
      }
    };

    const app = createApp({
      pool: withCurrentTokenVersion(pool),
      config: {
        jwtSecret: "test-secret",
        jwtExpiresIn: "7d"
      },
      now: () => new Date("2026-04-21T00:00:00Z"),
      generateApiKey() {
        return "22222222-2222-4222-8222-222222222222";
      }
    });

    const response = await request(app)
      .post("/api/auth/api-key")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    // The plaintext key is returned exactly once, together with its hint and creation time.
    assert.deepEqual(response.body, {
      api_key: "22222222-2222-4222-8222-222222222222",
      hint: "2222",
      created_at: "2026-04-21T00:00:00.000Z"
    });
    assert.match(
      updateQuery[0],
      /UPDATE users SET api_key_hash = \$1, api_key_hint = \$2, api_key_created_at = \$3 WHERE id = \$4 RETURNING api_key_hint, api_key_created_at/
    );
    // Only the hash and the hint reach the database, never the key itself.
    assert.deepEqual(updateQuery[1], [
      hashToken("22222222-2222-4222-8222-222222222222"),
      getApiKeyHint("22222222-2222-4222-8222-222222222222"),
      new Date("2026-04-21T00:00:00Z"),
      "user-1"
    ]);
    assert.equal(JSON.stringify(updateQuery[1]).includes("22222222-2222-4222-8222-222222222222"), false);
  });

  it("regenerates an API key for the authenticated user", async () => {
    const token = jwt.sign({ sub: "user-1" }, "test-secret", { expiresIn: "7d" });
    const generatedKeys = [
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444"
    ];
    const updates = [];
    const pool = {
      async query(_text, params) {
        updates.push(params);
        return { rows: [{ api_key_hint: params[1], api_key_created_at: params[2] }] };
      }
    };

    const app = createApp({
      pool: withCurrentTokenVersion(pool),
      config: {
        jwtSecret: "test-secret",
        jwtExpiresIn: "7d"
      },
      now: () => new Date("2026-04-21T00:00:00Z"),
      generateApiKey() {
        return generatedKeys.shift();
      }
    });

    const firstResponse = await request(app)
      .post("/api/auth/api-key")
      .set("Authorization", `Bearer ${token}`);
    const secondResponse = await request(app)
      .post("/api/auth/api-key")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.notEqual(firstResponse.body.api_key, secondResponse.body.api_key);
    assert.deepEqual(secondResponse.body, {
      api_key: "44444444-4444-4444-8444-444444444444",
      hint: "4444",
      created_at: "2026-04-21T00:00:00.000Z"
    });
    assert.deepEqual(updates, [
      [hashToken("33333333-3333-4333-8333-333333333333"), "3333", new Date("2026-04-21T00:00:00Z"), "user-1"],
      [hashToken("44444444-4444-4444-8444-444444444444"), "4444", new Date("2026-04-21T00:00:00Z"), "user-1"]
    ]);
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
    assert.deepEqual(response.body, { error: "Invalid email or password.", code: "auth.invalid_credentials" });
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
      error: "Please verify your email before logging in.",
      code: "auth.email_not_verified"
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
          assert.equal(params[0], hashToken("valid-token"));
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
      pool: withTransactions(pool),
      config: {
        jwtSecret: "test-secret",
        jwtExpiresIn: "7d"
      }
    });

    const response = await request(app).get("/api/auth/verify-email").query({ token: "valid-token" });

    assert.equal(response.status, 200);
    assert.equal(typeof response.body.token, "string");
    assert.deepEqual(response.body.user, {
      id: "user-1",
      email: "demo@example.com",
      display_name: "Demo User"
    });
    assert.equal(updatedUserId, "user-1");
    assert.equal(deletedToken, hashToken("valid-token"));
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

    const response = await request(app).get("/api/auth/verify-email").query({ token: "40000000-0000-4000-8000-000000000002" });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      error: "Verification link is invalid or has expired.",
      code: "auth.verification_invalid"
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
      pool: withTransactions(pool),
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
      hashToken("verification-token-2"),
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
      pool: withTransactions(pool),
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
      pool: withTransactions(pool),
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
      hashToken("reset-token-1"),
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
      pool: withTransactions(pool),
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

    const app = createApp({ pool: withTransactionClient(pool) });

    const response = await request(app).post("/api/auth/reset-password").send({
      token: "used-token",
      password: "new-password-123"
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      error: "Password reset link is invalid or has expired.",
      code: "auth.reset_invalid"
    });
  });

  it("updates the password and marks the reset token as used", async () => {
    let updatedPasswordParams = null;
    let markedToken = null;
    const { logger, getEntries } = createLogCapture();
    const pool = {
      async query(text, params) {
        if (["BEGIN", "COMMIT"].includes(text)) {
          return { rows: [] };
        }

        if (text.includes("UPDATE users")) {
          updatedPasswordParams = params;
          return { rows: [] };
        }

        // The single conditional UPDATE claims the token and returns its user.
        if (text.includes("UPDATE password_reset_tokens")) {
          markedToken = params[0];
          return { rows: [{ user_id: "user-1" }] };
        }

        if (text.includes("DELETE FROM password_reset_tokens")) {
          return { rows: [] };
        }

        throw new Error(`Unexpected query: ${text}`);
      }
    };

    const app = createApp({
      logger,
      pool: withTransactionClient(pool),
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
    assert.equal(markedToken, hashToken("valid-reset-token"));
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
    let nextError = null;

    middleware(req, res, (error) => {
      nextCalled = !error;
      nextError = error ?? null;
    });

    assert.equal(nextError?.status, 401);
    assert.equal(nextError?.code, "auth.token_required");
    assert.equal(nextError?.message, "Authentication token is required.");
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

    middleware(req, res, (error) => {
      nextCalled = !error;
    });

    assert.deepEqual(req.user, { sub: "user-1" });
    assert.equal(nextCalled, true);
  });
});

describe("requireApiKey middleware", () => {
  it("returns 401 when the API key header is missing", async () => {
    const middleware = createRequireApiKey({
      pool: {
        async query() {
          throw new Error("API key query should not run");
        }
      }
    });

    const req = { headers: {} };
    const res = createResponse();
    let nextCalled = false;
    let nextError = null;

    await middleware(req, res, (error) => {
      nextCalled = !error;
      nextError = error ?? null;
    });

    assert.equal(nextError?.status, 401);
    assert.equal(nextError?.code, "auth.api_key_required");
    assert.equal(nextError?.message, "API key is required.");
    assert.equal(nextCalled, false);
  });

  it("rejects a key that is not a UUID without querying the database", async () => {
    const middleware = createRequireApiKey({
      pool: {
        async query() {
          throw new Error("API key query should not run");
        }
      }
    });

    const req = { headers: { "x-api-key": "not-a-uuid" } };
    const res = createResponse();
    let nextCalled = false;
    let nextError = null;

    await middleware(req, res, (error) => {
      nextCalled = !error;
      nextError = error ?? null;
    });

    assert.equal(nextError?.status, 401);
    assert.equal(nextError?.code, "auth.invalid_api_key");
    assert.equal(nextError?.message, "Invalid API key.");
    assert.equal(nextCalled, false);
  });

  it("returns 401 when the API key is unknown", async () => {
    let apiKeyQuery = null;
    const middleware = createRequireApiKey({
      pool: {
        async query(text, params) {
          apiKeyQuery = [normalizeSql(text), params];
          return { rows: [] };
        }
      }
    });

    const req = { headers: { "x-api-key": "50000000-0000-4000-8000-000000000001" } };
    const res = createResponse();
    let nextCalled = false;
    let nextError = null;

    await middleware(req, res, (error) => {
      nextCalled = !error;
      nextError = error ?? null;
    });

    assert.equal(nextError?.status, 401);
    assert.equal(nextError?.code, "auth.invalid_api_key");
    assert.equal(nextError?.message, "Invalid API key.");
    assert.match(apiKeyQuery[0], /SELECT id FROM users WHERE api_key_hash = \$1 LIMIT 1/);
    assert.deepEqual(apiKeyQuery[1], [hashToken("50000000-0000-4000-8000-000000000001")]);
    assert.equal(nextCalled, false);
  });

  it("attaches the matching user for a valid API key", async () => {
    const middleware = createRequireApiKey({
      pool: {
        async query(_text, params) {
          assert.deepEqual(params, [hashToken("50000000-0000-4000-8000-000000000002")]);
          return { rows: [{ id: "user-1" }] };
        }
      }
    });

    const req = { headers: { "x-api-key": "50000000-0000-4000-8000-000000000002" } };
    const res = createResponse();
    let nextCalled = false;

    await middleware(req, res, (error) => {
      nextCalled = !error;
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

/**
 * Adds `connect()` to a query-only pool mock so code that uses `withTransaction` runs against the
 * same mock; BEGIN/COMMIT/ROLLBACK reach the mock's `query` like any other statement.
 */
function withTransactionClient(pool) {
  return {
    ...pool,
    async connect() {
      return { query: (text, params) => pool.query(text, params), release() {} };
    }
  };
}

/**
 * Answers the token version lookup of the auth middleware so route tests can keep their
 * single-purpose pool mocks. Every test token here carries no `tv` claim, i.e. version 0.
 */
function withCurrentTokenVersion(pool) {
  return {
    ...pool,
    async query(text, params) {
      if (text.includes("SELECT token_version FROM users")) {
        return { rows: [{ token_version: 0 }] };
      }

      return pool.query(text, params);
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
