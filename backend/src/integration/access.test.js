import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import request from "supertest";
import { createApp } from "../app.js";
import { createRequireAuth } from "../middleware/auth.js";
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

  before(async () => {
    db = await createTestDatabase();
    owner = await createUser(db.pool, { displayName: "Owner" });
    member = await createUser(db.pool, { displayName: "Member" });
    stranger = await createUser(db.pool, { displayName: "Stranger" });
    list = await createList(db.pool, { ownerId: owner.id });
    await addMember(db.pool, { listId: list.id, userId: member.id });
    await createEntry(db.pool, { listId: list.id, text: "Milk", lastUpdatedBy: owner.id });

    app = createApp({
      pool: db.pool,
      config: { jwtSecret: TEST_JWT_SECRET },
      // Real JWT verification, bound to the test secret instead of the process environment.
      requireAuthMiddleware: createRequireAuth({ config: { jwtSecret: TEST_JWT_SECRET } }),
      logger: pino({ level: "silent" })
    });
  });

  after(async () => {
    await db?.close();
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
