import { after, before, it } from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase, describeDb } from "./helpers.js";

describeDb("migrations (PostgreSQL)", () => {
  let db;

  before(async () => {
    db = await createTestDatabase();
  });

  after(async () => {
    await db?.close();
  });

  it("round-trips up -> down -> up with an identical schema", async () => {
    const before = await db.snapshot();
    assert.ok(before.columns.length > 0, "migrations created no columns");
    assert.ok(before.indexes.length > 0, "migrations created no indexes");

    await db.migrate("down");
    const afterDown = await db.snapshot();
    assert.deepEqual(afterDown, { columns: [], indexes: [], constraints: [] });

    await db.migrate("up");
    const afterUp = await db.snapshot();
    assert.deepEqual(afterUp, before);
  });
});
