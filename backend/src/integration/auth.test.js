import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { createApp } from "../app.js";
import { hashToken } from "../tokens.js";
import {
  TEST_JWT_SECRET,
  createTestDatabase,
  createUser,
  describeDb,
  signTestToken
} from "./helpers.js";

describeDb("session revocation and password reset (PostgreSQL)", () => {
  let db;
  let app;

  before(async () => {
    db = await createTestDatabase();
    app = createApp({
      pool: db.pool,
      startWorkers: false,
      logger: pino({ level: "silent" }),
      config: { jwtSecret: TEST_JWT_SECRET, jwtExpiresIn: "1h" }
    });
  });

  after(async () => {
    await db?.close();
  });

  async function createResetToken(userId, { expiresInMs = 60 * 60 * 1000, used = false } = {}) {
    const token = randomUUID();
    await db.pool.query(
      "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used) VALUES ($1, $2, $3, $4)",
      [userId, hashToken(token), new Date(Date.now() + expiresInMs), used]
    );
    return token;
  }

  const reset = (token, password = "brand-new-password") =>
    request(app).post("/api/auth/reset-password").send({ token, password });

  const me = (token) => request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

  async function tokenVersionOf(userId) {
    const { rows } = await db.pool.query("SELECT token_version FROM users WHERE id = $1", [userId]);
    return rows[0].token_version;
  }

  describe("token version", () => {
    it("starts at 0 and accepts tokens with tv 0 and tokens without the claim", async () => {
      const user = await createUser(db.pool);

      assert.equal(await tokenVersionOf(user.id), 0);
      assert.equal((await me(signTestToken(user.id, 0))).status, 200);
      assert.equal((await me(signTestToken(user.id))).status, 200);
    });

    it("rejects tokens whose version is ahead of or behind the stored one", async () => {
      const user = await createUser(db.pool);
      await db.pool.query("UPDATE users SET token_version = 2 WHERE id = $1", [user.id]);

      assert.equal((await me(signTestToken(user.id, 1))).status, 401);
      assert.equal((await me(signTestToken(user.id))).status, 401);
      assert.equal((await me(signTestToken(user.id, 3))).status, 401);
      assert.equal((await me(signTestToken(user.id, 2))).status, 200);
    });

    it("rejects the token of a user that was deleted", async () => {
      const user = await createUser(db.pool);
      await db.pool.query("DELETE FROM users WHERE id = $1", [user.id]);

      assert.equal((await me(signTestToken(user.id, 0))).status, 401);
    });
  });

  describe("password reset", () => {
    it("revokes tokens issued before the reset and lets the user log in again", async () => {
      const user = await createUser(db.pool, { email: `reset-${randomUUID()}@example.test` });
      const oldToken = signTestToken(user.id, 0);
      assert.equal((await me(oldToken)).status, 200);

      const response = await reset(await createResetToken(user.id));

      assert.equal(response.status, 200);
      assert.equal(await tokenVersionOf(user.id), 1);
      assert.equal((await me(oldToken)).status, 401);

      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: "brand-new-password" });
      assert.equal(login.status, 200);
      assert.equal((await me(login.body.token)).status, 200);
    });

    it("lets exactly one of two concurrent resets with the same token succeed", async () => {
      const user = await createUser(db.pool);
      const token = await createResetToken(user.id);

      const responses = await Promise.all([
        reset(token, "first-new-password"),
        reset(token, "second-new-password")
      ]);

      assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
      assert.equal(await tokenVersionOf(user.id), 1);
    });

    it("invalidates the user's other reset tokens", async () => {
      const user = await createUser(db.pool);
      const first = await createResetToken(user.id);
      const second = await createResetToken(user.id);

      assert.equal((await reset(first)).status, 200);

      const secondAttempt = await reset(second);
      assert.equal(secondAttempt.status, 400);
      const { rowCount } = await db.pool.query("SELECT 1 FROM password_reset_tokens WHERE user_id = $1", [user.id]);
      assert.equal(rowCount, 1);
    });

    it("does not touch other users' reset tokens", async () => {
      const user = await createUser(db.pool);
      const other = await createUser(db.pool);
      const otherToken = await createResetToken(other.id);

      assert.equal((await reset(await createResetToken(user.id))).status, 200);

      assert.equal((await reset(otherToken)).status, 200);
    });

    it("clears the API key", async () => {
      const user = await createUser(db.pool);
      await db.pool.query("UPDATE users SET api_key_hash = $1, api_key_hint = $2 WHERE id = $3", [hashToken(randomUUID()), "abcd", user.id]);

      assert.equal((await reset(await createResetToken(user.id))).status, 200);

      const { rows } = await db.pool.query("SELECT api_key_hash, api_key_hint FROM users WHERE id = $1", [user.id]);
      assert.equal(rows[0].api_key_hash, null);
      assert.equal(rows[0].api_key_hint, null);
    });

    it("rejects expired and already used tokens without changing the user", async () => {
      const user = await createUser(db.pool);
      const expired = await createResetToken(user.id, { expiresInMs: -1000 });
      const used = await createResetToken(user.id, { used: true });

      assert.equal((await reset(expired)).status, 400);
      assert.equal((await reset(used)).status, 400);
      assert.equal(await tokenVersionOf(user.id), 0);
    });
  });
});
