import { after, before, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { createApp } from "../app.js";
import { hashToken } from "../tokens.js";
import {
  TEST_JWT_SECRET,
  createInvite,
  createList,
  createTestDatabase,
  createUser,
  describeDb,
  signTestToken
} from "./helpers.js";

describeDb("hashed credentials (PostgreSQL)", () => {
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

  const bearer = (userId) => `Bearer ${signTestToken(userId, 0)}`;

  it("stores no plaintext credential column anywhere in the schema", async () => {
    const { rows } = await db.pool.query(
      `
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND ((table_name = 'users' AND column_name = 'api_key')
            OR (table_name IN ('email_verification_tokens', 'password_reset_tokens', 'list_invites')
                AND column_name = 'token'))
      `,
      [db.schema]
    );

    assert.deepEqual(rows, []);
  });

  it("keeps a key that was issued before the migration working", async () => {
    const user = await createUser(db.pool);
    const legacyKey = randomUUID().toUpperCase();

    // Roll the hash migration back, store a plaintext key the old way, then migrate forward again.
    await db.migrate("down", 1);
    await db.pool.query("UPDATE users SET api_key = $1 WHERE id = $2", [legacyKey, user.id]);
    await db.migrate("up");

    const lists = await request(app).get("/api/v1/lists").set("X-Api-Key", legacyKey);
    assert.equal(lists.status, 200);

    const status = await request(app).get("/api/auth/api-key").set("Authorization", bearer(user.id));
    assert.equal(status.body.has_key, true);
    assert.equal(status.body.hint, legacyKey.toLowerCase().slice(-4));
  });

  it("returns the plaintext key once and never from GET", async () => {
    const user = await createUser(db.pool);

    const created = await request(app).post("/api/auth/api-key").set("Authorization", bearer(user.id));
    assert.equal(created.status, 200);
    assert.match(created.body.api_key, /^[0-9a-f-]{36}$/);
    assert.equal(created.body.hint, created.body.api_key.slice(-4));

    const stored = await db.pool.query("SELECT api_key_hash FROM users WHERE id = $1", [user.id]);
    assert.equal(stored.rows[0].api_key_hash, hashToken(created.body.api_key));
    assert.notEqual(stored.rows[0].api_key_hash, created.body.api_key);

    const read = await request(app).get("/api/auth/api-key").set("Authorization", bearer(user.id));
    assert.deepEqual(Object.keys(read.body).sort(), ["created_at", "has_key", "hint"]);
    assert.equal(read.body.has_key, true);
    assert.equal(JSON.stringify(read.body).includes(created.body.api_key), false);

    const viaKey = await request(app).get("/api/v1/lists").set("X-Api-Key", created.body.api_key);
    assert.equal(viaKey.status, 200);
  });

  it("reports no key for a user that never generated one", async () => {
    const user = await createUser(db.pool);

    const read = await request(app).get("/api/auth/api-key").set("Authorization", bearer(user.id));

    assert.deepEqual(read.body, { has_key: false, hint: null, created_at: null });
  });

  it("invalidates the old key when a new one is generated", async () => {
    const user = await createUser(db.pool);
    const first = await request(app).post("/api/auth/api-key").set("Authorization", bearer(user.id));
    await request(app).post("/api/auth/api-key").set("Authorization", bearer(user.id));

    const response = await request(app).get("/api/v1/lists").set("X-Api-Key", first.body.api_key);

    assert.equal(response.status, 401);
  });

  it("looks up invites by the hash of the presented token", async () => {
    const owner = await createUser(db.pool);
    const list = await createList(db.pool, { ownerId: owner.id });
    const invite = await createInvite(db.pool, {
      listId: list.id,
      invitedEmail: "guest@example.test",
      invitedBy: owner.id
    });

    const guest = await createUser(db.pool, { email: "guest@example.test" });
    const unknown = await request(app).get(`/api/invites/${randomUUID()}`).set("Authorization", bearer(guest.id));
    assert.equal(unknown.status, 400);

    const accepted = await request(app).get(`/api/invites/${invite.token}`).set("Authorization", bearer(guest.id));
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.listId, list.id);

    const stored = await db.pool.query("SELECT token_hash FROM list_invites WHERE id = $1", [invite.id]);
    assert.equal(stored.rows[0].token_hash, hashToken(invite.token));
  });
});
