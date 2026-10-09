import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";
import { hashToken } from "./tokens.js";

function createAuthedApp(pool, options = {}) {
  return createApp({
    pool,
    sseManager: options.sseManager ?? createSseManagerSpy(),
    requireAuthMiddleware(req, _res, next) {
      req.user = { sub: "user-1" };
      next();
    }
  });
}

/**
 * Pool fake for the acceptance flow. `claimRows` is the result of the atomic
 * `UPDATE list_invites ... RETURNING list_id`; `insertedRows` that of the membership insert.
 */
function createInvitePool({
  invitedEmail = "Guest@Example.com",
  userEmail = "guest@example.com",
  ownerId = "owner-1",
  claimRows = [{ list_id: "list-1" }],
  insertedRows = [{ user_id: "user-1" }]
} = {}) {
  const statements = [];
  const run = async (text, params) => {
    const sql = normalizeSql(text);
    statements.push([sql, params]);

    if (sql.includes("FROM list_invites") && sql.startsWith("SELECT")) {
      return { rows: [{ id: "invite-1", list_id: "list-1", invited_email: invitedEmail, status: "pending" }] };
    }
    if (sql.startsWith("SELECT email FROM users")) {
      return { rows: [{ email: userEmail }] };
    }
    if (sql.startsWith("SELECT owner_id FROM lists")) {
      return { rows: [{ owner_id: ownerId }] };
    }
    if (sql.startsWith("UPDATE list_invites")) {
      return { rows: claimRows };
    }
    if (sql.startsWith("INSERT INTO list_members")) {
      return { rows: insertedRows };
    }
    return { rows: [] };
  };

  return {
    statements,
    query: run,
    async connect() {
      return { query: run, release() {} };
    }
  };
}

describe("invite routes", () => {
  it("accepts a pending invite for the invited email in one transaction", async () => {
    const sseManager = createSseManagerSpy();
    const pool = createInvitePool();

    const response = await request(createAuthedApp(pool, { sseManager })).get("/api/invites/40000000-0000-4000-8000-000000000001");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { listId: "list-1" });
    const sql = pool.statements.map(([text]) => text.split(" ").slice(0, 3).join(" "));
    assert.deepEqual(sql, [
      "SELECT id, list_id,",
      "SELECT email FROM",
      "SELECT owner_id FROM",
      "BEGIN",
      "UPDATE list_invites SET",
      "INSERT INTO list_members",
      "COMMIT"
    ]);
    const claim = pool.statements.find(([text]) => text.startsWith("UPDATE list_invites"));
    assert.match(claim[0], /SET status = 'accepted' WHERE id = \$1 AND status = 'pending' AND expires_at > \$2 RETURNING list_id/);
    assert.equal(claim[0].includes("token"), false);
    assert.equal(claim[1][0], "invite-1");
    assert.equal(claim[1][1] instanceof Date, true);
    assert.equal(pool.statements[0][1][0], hashToken("40000000-0000-4000-8000-000000000001"));
    assert.deepEqual(sseManager.calls, [["list-1", "member:added", { listId: "list-1", userId: "user-1" }]]);
  });

  it("answers 403 and changes nothing when the account has a different email", async () => {
    const sseManager = createSseManagerSpy();
    const pool = createInvitePool({ userEmail: "other@example.com" });

    const response = await request(createAuthedApp(pool, { sseManager })).get("/api/invites/40000000-0000-4000-8000-000000000001");

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { error: "This invitation was sent to a different email address." });
    assert.equal(pool.statements.some(([text]) => text.startsWith("UPDATE") || text.startsWith("INSERT")), false);
    assert.deepEqual(sseManager.calls, []);
  });

  it("answers 409 for the list owner and leaves the invite pending", async () => {
    const sseManager = createSseManagerSpy();
    const pool = createInvitePool({ ownerId: "user-1" });

    const response = await request(createAuthedApp(pool, { sseManager })).get("/api/invites/40000000-0000-4000-8000-000000000001");

    assert.equal(response.status, 409);
    assert.deepEqual(response.body, { error: "You already own this list." });
    assert.equal(pool.statements.some(([text]) => text.startsWith("UPDATE") || text.startsWith("INSERT")), false);
    assert.deepEqual(sseManager.calls, []);
  });

  it("answers 400 when another request already used the invite", async () => {
    const sseManager = createSseManagerSpy();
    const pool = createInvitePool({ claimRows: [] });

    const response = await request(createAuthedApp(pool, { sseManager })).get("/api/invites/40000000-0000-4000-8000-000000000001");

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "Invitation link is invalid or has expired." });
    assert.equal(pool.statements.some(([text]) => text.startsWith("INSERT")), false);
    assert.deepEqual(sseManager.calls, []);
  });

  it("returns the list id without a broadcast when the invited user is already a member", async () => {
    const sseManager = createSseManagerSpy();
    const pool = createInvitePool({ insertedRows: [] });

    const response = await request(createAuthedApp(pool, { sseManager })).get("/api/invites/40000000-0000-4000-8000-000000000004");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { listId: "list-1" });
    assert.deepEqual(sseManager.calls, []);
  });

  it("rejects invalid or expired invites", async () => {
    const pool = {
      async query() {
        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/invites/40000000-0000-4000-8000-000000000002");

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      error: "Invitation link is invalid or has expired."
    });
  });
});

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}

function createSseManagerSpy() {
  return {
    calls: [],
    broadcastToList(pool, listId, eventType, data) {
      void pool;
      this.calls.push([listId, eventType, data]);
      return Promise.resolve();
    }
  };
}
