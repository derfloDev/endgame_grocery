import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import request from "supertest";
import { createApp } from "../app.js";
import { ensureListAccess } from "../middleware/listAccess.js";
import {
  TEST_JWT_SECRET,
  addMember,
  createEntry,
  createList,
  createTestDatabase,
  createUser,
  describeDb,
  signTestToken
} from "./helpers.js";

describeDb("list access (PostgreSQL)", () => {
  let db;
  let owner;
  let member;
  let stranger;
  let list;
  let app;
  let entry;
  const events = [];
  const mails = [];

  before(async () => {
    db = await createTestDatabase();
    owner = await createUser(db.pool, { displayName: "Owner" });
    member = await createUser(db.pool, { displayName: "Member" });
    stranger = await createUser(db.pool, { displayName: "Stranger" });
    list = await createList(db.pool, { ownerId: owner.id });
    await addMember(db.pool, { listId: list.id, userId: member.id });
    entry = await createEntry(db.pool, { listId: list.id, text: "Milk", lastUpdatedBy: owner.id });

    app = createApp({
      pool: db.pool,
      // The app wires real JWT verification (including the token version lookup) from this config.
      config: { jwtSecret: TEST_JWT_SECRET },
      logger: pino({ level: "silent" }),
      startWorkers: false,
      sseManager: {
        async broadcastToList(...args) { events.push(args); },
        sendToUsers(...args) { events.push(args); }
      },
      mailer: { async send(message) { mails.push(message); } }
    });
  });

  after(async () => {
    await db?.close();
  });

  // Compare persisted rows, not only status codes: rejected writes must leave both the list
  // and its asynchronous delivery queues untouched.
  async function snapshot() {
    const result = {};
    for (const table of ["entries", "pending_push_jobs", "list_members", "list_invites"]) {
      result[table] = (await db.pool.query(`SELECT * FROM ${table} ORDER BY 1, 2`)).rows;
    }
    return result;
  }

  for (const method of ["get", "post", "patch", "delete"]) {
    it(`denies stranger ${method.toUpperCase()} entries without persisted changes or events`, async () => {
      const beforeState = await snapshot();
      const suffix = ["patch", "delete"].includes(method) ? `/${entry.id}` : "";
      const response = await request(app)[method](`/api/lists/${list.id}/entries${suffix}`)
        .set("Authorization", `Bearer ${signTestToken(stranger.id)}`)
        .send({ text: "Forbidden edit", status: "done" });

      assert.equal(response.status, 403);
      assert.equal(response.body.code, "list.forbidden");
      assert.deepEqual(await snapshot(), beforeState);
      assert.deepEqual(events, []);
      assert.deepEqual(mails, []);
    });
  }

  for (const method of ["patch", "delete"]) {
    it(`does not ${method} another list's entry through an accessible list id`, async () => {
      const strangersList = await createList(db.pool, { ownerId: stranger.id });
      const beforeState = await snapshot();
      const response = await request(app)[method](`/api/lists/${strangersList.id}/entries/${entry.id}`)
        .set("Authorization", `Bearer ${signTestToken(stranger.id)}`)
        .send({ text: "Cross-list edit", status: "done" });

      assert.equal(response.status, 404);
      assert.equal(response.body.code, "entry.not_found");
      assert.deepEqual(await snapshot(), beforeState);
      assert.deepEqual(events, []);
    });
  }

  for (const actor of ["member", "stranger"]) {
    for (const method of ["get", "post", "delete"]) {
      it(`denies ${actor} ${method.toUpperCase()} sharing without writes, mail or events`, async () => {
        const beforeState = await snapshot();
        const user = actor === "member" ? member : stranger;
        const suffix = method === "delete" ? `/${member.id}` : "";
        const response = await request(app)[method](`/api/lists/${list.id}/members${suffix}`)
          .set("Authorization", `Bearer ${signTestToken(user.id)}`)
          .send({ email: stranger.email });

        assert.equal(response.status, 403);
        assert.equal(response.body.code, "list.owner_only_sharing");
        assert.deepEqual(await snapshot(), beforeState);
        assert.deepEqual(mails, []);
        assert.deepEqual(events, []);
      });
    }
  }

  it("returns 404 when the owner revokes a non-member, without side effects", async () => {
    const beforeState = await snapshot();
    const response = await request(app).delete(`/api/lists/${list.id}/members/${stranger.id}`)
      .set("Authorization", `Bearer ${signTestToken(owner.id)}`);
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "sharing.member_not_found");
    assert.deepEqual(await snapshot(), beforeState);
    assert.deepEqual(mails, []);
    assert.deepEqual(events, []);
  });

  describe("ensureListAccess", () => {
    it("allows the owner", async () => {
      assert.equal(await ensureListAccess(db.pool, list.id, owner.id), true);
    });

    it("allows a member", async () => {
      assert.equal(await ensureListAccess(db.pool, list.id, member.id), true);
    });

    it("denies a stranger", async () => {
      assert.equal(await ensureListAccess(db.pool, list.id, stranger.id), false);
    });

    it("denies access to a list that does not exist", async () => {
      assert.equal(
        await ensureListAccess(db.pool, "00000000-0000-4000-8000-000000000000", owner.id),
        false
      );
    });
  });

  describe("GET /api/lists/:id/entries", () => {
    it("returns the entries to the owner", async () => {
      const response = await request(app)
        .get(`/api/lists/${list.id}/entries`)
        .set("Authorization", `Bearer ${signTestToken(owner.id)}`);

      assert.equal(response.status, 200);
      assert.deepEqual(
        response.body.entries.map((entry) => entry.text),
        ["Milk"]
      );
    });

    it("returns the entries to a member", async () => {
      const response = await request(app)
        .get(`/api/lists/${list.id}/entries`)
        .set("Authorization", `Bearer ${signTestToken(member.id)}`);

      assert.equal(response.status, 200);
      assert.equal(response.body.entries.length, 1);
    });

    it("answers 403 for a stranger", async () => {
      const response = await request(app)
        .get(`/api/lists/${list.id}/entries`)
        .set("Authorization", `Bearer ${signTestToken(stranger.id)}`);

      assert.equal(response.status, 403);
    });
  });
});
