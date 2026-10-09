import { after, before, it } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import request from "supertest";
import { createApp } from "../app.js";
import {
  TEST_JWT_SECRET,
  createInvite,
  createList,
  createTestDatabase,
  createUser,
  describeDb,
  signTestToken
} from "./helpers.js";

describeDb("invite acceptance (PostgreSQL)", () => {
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

  const accept = (token, userId) =>
    request(app).get(`/api/invites/${token}`).set("Authorization", `Bearer ${signTestToken(userId, 0)}`);

  const memberCount = async (listId, userId) =>
    (await db.pool.query("SELECT 1 FROM list_members WHERE list_id = $1 AND user_id = $2", [listId, userId]))
      .rowCount;

  const inviteStatus = async (id) =>
    (await db.pool.query("SELECT status FROM list_invites WHERE id = $1", [id])).rows[0].status;

  async function setup() {
    const owner = await createUser(db.pool);
    const guest = await createUser(db.pool, { email: `guest-${Date.now()}-${Math.random()}@example.test` });
    const list = await createList(db.pool, { ownerId: owner.id });
    const invite = await createInvite(db.pool, { listId: list.id, invitedEmail: guest.email, invitedBy: owner.id });
    return { owner, guest, list, invite };
  }

  it("lets the invited account join, matching the email case-insensitively", async () => {
    const { guest, list, invite } = await setup();
    await db.pool.query("UPDATE users SET email = UPPER(email) WHERE id = $1", [guest.id]);

    const response = await accept(invite.token, guest.id);

    assert.equal(response.status, 200);
    assert.equal(response.body.listId, list.id);
    assert.equal(await memberCount(list.id, guest.id), 1);
    assert.equal(await inviteStatus(invite.id), "accepted");
  });

  it("refuses a different account with 403 and creates no membership", async () => {
    const { list, invite } = await setup();
    const stranger = await createUser(db.pool);

    const response = await accept(invite.token, stranger.id);

    assert.equal(response.status, 403);
    assert.equal(await memberCount(list.id, stranger.id), 0);
    assert.equal(await inviteStatus(invite.id), "pending");
  });

  it("answers 409 to the owner and keeps the invite pending for the invitee", async () => {
    const { owner, guest, list, invite } = await setup();
    await db.pool.query("UPDATE users SET email = $1 WHERE id = $2", [guest.email + ".old", guest.id]);
    await db.pool.query("UPDATE users SET email = $1 WHERE id = $2", [guest.email, owner.id]);

    const response = await accept(invite.token, owner.id);

    assert.equal(response.status, 409);
    assert.equal(await memberCount(list.id, owner.id), 0);
    assert.equal(await inviteStatus(invite.id), "pending");
  });

  it("is single use, also when two requests race", async () => {
    const { guest, invite } = await setup();

    const responses = await Promise.all([accept(invite.token, guest.id), accept(invite.token, guest.id)]);

    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
    assert.equal((await accept(invite.token, guest.id)).status, 400);
  });

  it("does not auto-verify a registration with another email's invite", async () => {
    const { list, invite } = await setup();

    const response = await request(app).post("/api/auth/register").send({
      email: `other-${Date.now()}@example.test`,
      password: "a-long-password",
      display_name: "Other",
      invite_token: invite.token
    });

    assert.equal(response.status, 201);
    const user = (await db.pool.query("SELECT id, email_verified FROM users WHERE id = $1", [response.body.user?.id ?? null]))
      .rows[0];
    const created = user ?? (await db.pool.query("SELECT id, email_verified FROM users ORDER BY created_at DESC LIMIT 1")).rows[0];
    assert.equal(created.email_verified, false);
    assert.equal(await memberCount(list.id, created.id), 0);
    assert.equal(await inviteStatus(invite.id), "pending");
  });
});
