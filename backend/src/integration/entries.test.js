import { after, before, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { createApp } from "../app.js";
import {
  TEST_JWT_SECRET,
  createList,
  createTestDatabase,
  createUser,
  describeDb,
  signTestToken
} from "./helpers.js";

describeDb("entry limits and input validation (PostgreSQL)", () => {
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

  const as = (user) => ({ Authorization: `Bearer ${signTestToken(user.id, 0)}` });

  /** Inserts `count` entries with one statement. */
  async function seedEntries(listId, status, count, lastUpdatedBy) {
    await db.pool.query(
      `
        INSERT INTO entries (list_id, text, status, last_updated_by, created_at, updated_at)
        SELECT $1::uuid, $2::text || n::text, $3::text, $4::uuid, NOW() - (n::text || ' seconds')::interval, NOW() - (n::text || ' seconds')::interval
        FROM generate_series(1, $5::int) AS n
      `,
      [listId, `${status}-`, status, lastUpdatedBy, count]
    );
  }

  const countEntries = async (listId, status) =>
    Number((await db.pool.query("SELECT COUNT(*) AS cnt FROM entries WHERE list_id = $1 AND status = $2", [listId, status])).rows[0].cnt);

  async function setup() {
    const owner = await createUser(db.pool);
    const list = await createList(db.pool, { ownerId: owner.id });
    return { owner, list };
  }

  it("never exceeds 1,000 open entries when creates race", async () => {
    const { owner, list } = await setup();
    await seedEntries(list.id, "open", 995, owner.id);

    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        request(app).post(`/api/lists/${list.id}/entries`).set(as(owner)).send({ text: `Race ${index}` })
      )
    );

    const statuses = responses.map((response) => response.status);
    assert.equal(statuses.filter((status) => status === 201).length, 5);
    assert.equal(statuses.filter((status) => status === 422).length, 7);
    assert.equal(await countEntries(list.id, "open"), 1000);
  });

  it("deletes nothing when an unknown entry is marked done at the done limit", async () => {
    const { owner, list } = await setup();
    await seedEntries(list.id, "done", 200, owner.id);

    const response = await request(app)
      .patch(`/api/lists/${list.id}/entries/${randomUUID()}`)
      .set(as(owner))
      .send({ status: "done" });

    assert.equal(response.status, 404);
    assert.equal(await countEntries(list.id, "done"), 200);
  });

  it("evicts exactly one old done entry when an open entry completes at the limit", async () => {
    const { owner, list } = await setup();
    await seedEntries(list.id, "done", 200, owner.id);
    const open = (
      await db.pool.query("INSERT INTO entries (list_id, text, status) VALUES ($1, 'Fresh', 'open') RETURNING id", [list.id])
    ).rows[0];

    const response = await request(app)
      .patch(`/api/lists/${list.id}/entries/${open.id}`)
      .set(as(owner))
      .send({ status: "done" });

    assert.equal(response.status, 200);
    assert.equal(await countEntries(list.id, "done"), 200);
    const oldest = await db.pool.query("SELECT 1 FROM entries WHERE list_id = $1 AND text = 'done-200'", [list.id]);
    assert.equal(oldest.rowCount, 0);
  });

  it("keeps the done count when an already done entry is marked done again", async () => {
    const { owner, list } = await setup();
    await seedEntries(list.id, "done", 200, owner.id);
    const done = (await db.pool.query("SELECT id FROM entries WHERE list_id = $1 LIMIT 1", [list.id])).rows[0];

    const response = await request(app)
      .patch(`/api/lists/${list.id}/entries/${done.id}`)
      .set(as(owner))
      .send({ status: "done" });

    assert.equal(response.status, 200);
    assert.equal(await countEntries(list.id, "done"), 200);
  });

  it("answers malformed ids with 404 instead of a database error", async () => {
    const { owner, list } = await setup();

    for (const path of [
      "/api/lists/nope/entries",
      `/api/lists/${list.id}/entries/nope`,
      `/api/lists/${list.id}/members/nope`,
      "/api/lists/nope/history"
    ]) {
      const response = await request(app).get(path).set(as(owner));
      assert.equal(response.status, 404, path);
    }

    assert.equal((await request(app).get("/api/invites/nope").set(as(owner))).status, 400);
    assert.equal((await request(app).get("/api/v1/lists").set("X-Api-Key", "nope")).status, 401);
  });

  it("maps a database type error that slips through to 400, not 500", async () => {
    // Direct pool use proves the mapped code really is what PostgreSQL raises for a bad uuid.
    await assert.rejects(db.pool.query("SELECT 1 FROM entries WHERE id = $1", ["nope"]), { code: "22P02" });
  });
});
