import { after, before, it } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import request from "supertest";
import { createApp } from "../app.js";
import {
  TEST_JWT_SECRET,
  addMember,
  createList,
  createTestDatabase,
  createUser,
  describeDb,
  signTestToken
} from "./helpers.js";

/** Collects every node of an EXPLAIN (FORMAT JSON) plan. */
function planNodes(node, found = []) {
  found.push(node);
  for (const child of node.Plans ?? []) {
    planNodes(child, found);
  }
  return found;
}

describeDb("query indexes and the single-list endpoint (PostgreSQL)", () => {
  let db;
  let app;
  let recorded;
  let owner;
  let member;
  let stranger;
  let list;

  before(async () => {
    db = await createTestDatabase();

    // Records every statement the API runs so the plans are checked for the real queries.
    recorded = [];
    const recordingPool = {
      query(sql, params) {
        recorded.push([sql, params]);
        return db.pool.query(sql, params);
      },
      connect: () => db.pool.connect()
    };
    app = createApp({
      pool: recordingPool,
      startWorkers: false,
      logger: pino({ level: "silent" }),
      config: { jwtSecret: TEST_JWT_SECRET, jwtExpiresIn: "1h" }
    });

    owner = await createUser(db.pool);
    member = await createUser(db.pool);
    stranger = await createUser(db.pool);
    list = await createList(db.pool, { ownerId: owner.id });
    await addMember(db.pool, { listId: list.id, userId: member.id });

    // Many lists and entries so the planner has a reason to prefer the indexes.
    for (let index = 0; index < 40; index += 1) {
      const other = await createList(db.pool, { ownerId: stranger.id, name: `Other ${index}` });
      await db.pool.query(
        `
          INSERT INTO entries (list_id, text, status, last_updated_by)
          SELECT $1::uuid, 'item ' || n::text, CASE WHEN n % 3 = 0 THEN 'done' ELSE 'open' END, $2::uuid
          FROM generate_series(1, 300) AS n
        `,
        [other.id, stranger.id]
      );
    }
    await db.pool.query(
      `
        INSERT INTO entries (list_id, text, status, last_updated_by)
        SELECT $1::uuid, 'milk ' || n::text, CASE WHEN n % 3 = 0 THEN 'done' ELSE 'open' END, $2::uuid
        FROM generate_series(1, 300) AS n
      `,
      [list.id, owner.id]
    );
    await db.pool.query("ANALYZE");
  });

  after(async () => {
    await db?.close();
  });

  const bearer = (user) => ({ Authorization: `Bearer ${signTestToken(user.id, 0)}` });

  async function assertNoEntriesSeqScan(label, statements) {
    assert.ok(statements.length > 0, `${label}: no statement was captured`);

    for (const [sql, params] of statements) {
      const explained = await db.pool.query(`EXPLAIN (FORMAT JSON) ${sql}`, params);
      const nodes = planNodes(explained.rows[0]["QUERY PLAN"][0].Plan);
      const seqScans = nodes.filter((node) => node["Node Type"] === "Seq Scan" && node["Relation Name"] === "entries");

      assert.deepEqual(seqScans, [], `${label}: sequential scan on entries for\n${sql}`);
    }
  }

  async function capture(call) {
    recorded.length = 0;
    const response = await call();
    assert.equal(response.status, 200);
    return recorded.filter(([sql]) => /\bentries\b/.test(sql) && /^\s*SELECT/i.test(sql));
  }

  it("creates the expected indexes", async () => {
    const { rows } = await db.pool.query("SELECT indexname FROM pg_indexes WHERE schemaname = $1", [db.schema]);
    const names = rows.map((row) => row.indexname);

    for (const name of [
      "entries_list_status_created_idx",
      "entries_list_updated_idx",
      "lists_owner_idx",
      "list_members_user_idx",
      "pending_push_jobs_fire_at_idx",
      "push_subscriptions_endpoint_idx",
      "entries_text_trgm_idx"
    ]) {
      assert.ok(names.includes(name), `${name} is missing`);
    }
  });

  it("reads the entries of a list without a sequential scan", async () => {
    const statements = await capture(() => request(app).get(`/api/lists/${list.id}/entries`).set(bearer(member)));
    await assertNoEntriesSeqScan("entries", statements);
  });

  it("reads the history of a list without a sequential scan", async () => {
    const statements = await capture(() => request(app).get(`/api/lists/${list.id}/history`).set(bearer(member)));
    await assertNoEntriesSeqScan("history", statements);
  });

  it("reads suggestions without a sequential scan", async () => {
    const statements = await capture(() =>
      request(app).get(`/api/lists/${list.id}/suggestions`).query({ q: "milk" }).set(bearer(member))
    );
    await assertNoEntriesSeqScan("suggestions", statements);
  });

  it("builds the overview without a sequential scan on entries", async () => {
    const statements = await capture(() => request(app).get("/api/lists").set(bearer(member)));
    await assertNoEntriesSeqScan("overview", statements);
  });

  it("answers the single-list endpoint for owner and member, and 403 for strangers", async () => {
    const asOwner = await request(app).get(`/api/lists/${list.id}`).set(bearer(owner));
    assert.equal(asOwner.status, 200);
    assert.equal(asOwner.body.list.is_owner, true);

    const asMember = await request(app).get(`/api/lists/${list.id}`).set(bearer(member));
    assert.equal(asMember.status, 200);
    assert.equal(asMember.body.list.is_owner, false);
    assert.equal(asMember.body.list.owner_id, owner.id);
    assert.equal(asMember.body.list.owner_name, "Test User");

    const asStranger = await request(app).get(`/api/lists/${list.id}`).set(bearer(stranger));
    assert.equal(asStranger.status, 403);
  });
});
