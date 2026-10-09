import { after, before, it } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import request from "supertest";
import { createApp } from "../app.js";
import { TEST_JWT_SECRET, addMember, createList, createTestDatabase, createUser, describeDb, signTestToken } from "./helpers.js";

describeDb("entry service shared by the app API and v1 (PostgreSQL)", () => {
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

  async function setup() {
    const owner = await createUser(db.pool);
    const member = await createUser(db.pool);
    const list = await createList(db.pool, { ownerId: owner.id });
    await addMember(db.pool, { listId: list.id, userId: member.id });
    const keyResponse = await request(app)
      .post("/api/auth/api-key")
      .set("Authorization", `Bearer ${signTestToken(owner.id, 0)}`);
    return { owner, member, list, apiKey: keyResponse.body.api_key };
  }

  const v1 = (apiKey) => ({ "X-Api-Key": apiKey });

  const lastUpdatedBy = async (entryId) =>
    (await db.pool.query("SELECT last_updated_by FROM entries WHERE id = $1", [entryId])).rows[0].last_updated_by;

  /** Runs `sql` until it returns a row, for work the server finishes after it has responded. */
  async function waitForRows(sql, params, { timeoutMs = 5000, intervalMs = 25 } = {}) {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const result = await db.pool.query(sql, params);

      if (result.rowCount > 0) {
        return result;
      }

      if (Date.now() >= deadline) {
        assert.fail(`No row appeared within ${timeoutMs} ms for: ${sql}`);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  it("sets last_updated_by and queues a push for items created through v1", async () => {
    const { owner, list, apiKey } = await setup();

    const response = await request(app)
      .post(`/api/v1/lists/${list.id}/items`)
      .set(v1(apiKey))
      .send({ name: "Milk", description: "  2%  " });

    assert.equal(response.status, 201);
    assert.equal(response.body.item.description, "2%");
    assert.equal(await lastUpdatedBy(response.body.item.id), owner.id);

    // The push job is queued without waiting for the response, so poll for it instead of guessing a
    // delay: how long the insert takes depends on how busy the (parallel) test run is.
    const jobs = await waitForRows("SELECT items FROM pending_push_jobs WHERE list_id = $1", [list.id]);
    assert.deepEqual(jobs.rows[0].items, ["Milk"]);
  });

  it("sets last_updated_by when v1 toggles and renames", async () => {
    const { owner, member, list, apiKey } = await setup();
    const entry = (
      await db.pool.query(
        "INSERT INTO entries (list_id, text, status, last_updated_by) VALUES ($1, 'Bread', 'open', $2) RETURNING id",
        [list.id, member.id]
      )
    ).rows[0];

    const toggled = await request(app).post(`/api/v1/lists/${list.id}/items/${entry.id}/toggle`).set(v1(apiKey));
    assert.equal(toggled.status, 200);
    assert.equal(toggled.body.item.status, "done");
    assert.equal(await lastUpdatedBy(entry.id), owner.id);

    await db.pool.query("UPDATE entries SET last_updated_by = $1 WHERE id = $2", [member.id, entry.id]);
    const renamed = await request(app)
      .patch(`/api/v1/lists/${list.id}/items/${entry.id}`)
      .set(v1(apiKey))
      .send({ name: "Rye bread" });
    assert.equal(renamed.status, 200);
    assert.equal(await lastUpdatedBy(entry.id), owner.id);
  });

  it("answers 422 from v1 at the open-entry cap", async () => {
    const { owner, list, apiKey } = await setup();
    await db.pool.query(
      "INSERT INTO entries (list_id, text, status, last_updated_by) SELECT $1::uuid, 'open-' || n::text, 'open', $2::uuid FROM generate_series(1, 1000) AS n",
      [list.id, owner.id]
    );

    const response = await request(app).post(`/api/v1/lists/${list.id}/items`).set(v1(apiKey)).send({ name: "One too many" });

    assert.equal(response.status, 422);
    const count = await db.pool.query("SELECT COUNT(*) AS cnt FROM entries WHERE list_id = $1", [list.id]);
    assert.equal(Number(count.rows[0].cnt), 1000);
  });

  it("keeps v1 and the app API consistent for the same entry", async () => {
    const { owner, list, apiKey } = await setup();
    const bearer = { Authorization: `Bearer ${signTestToken(owner.id, 0)}` };

    const created = await request(app).post(`/api/v1/lists/${list.id}/items`).set(v1(apiKey)).send({ name: "Eggs" });
    const listed = await request(app).get(`/api/lists/${list.id}/entries`).set(bearer);

    assert.equal(listed.status, 200);
    assert.equal(listed.body.entries[0].id, created.body.item.id);
    assert.equal(listed.body.entries[0].last_updated_by, owner.id);
  });
});
