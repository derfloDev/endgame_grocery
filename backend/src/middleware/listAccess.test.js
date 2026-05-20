import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ensureListAccess } from "./listAccess.js";

describe("ensureListAccess", () => {
  it("returns true when the authenticated user can access the list", async () => {
    const calls = [];
    const pool = {
      async query(sql, params) {
        calls.push({ sql, params });
        return { rows: [{ id: "list-1" }] };
      }
    };

    const hasAccess = await ensureListAccess(pool, "list-1", "user-1");

    assert.equal(hasAccess, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /FROM lists l/);
    assert.match(calls[0].sql, /LEFT JOIN list_members lm/);
    assert.deepEqual(calls[0].params, ["list-1", "user-1"]);
  });

  it("returns false when the authenticated user cannot access the list", async () => {
    const pool = {
      async query() {
        return { rows: [] };
      }
    };

    const hasAccess = await ensureListAccess(pool, "list-1", "user-2");

    assert.equal(hasAccess, false);
  });
});
