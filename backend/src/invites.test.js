import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";

function createAuthedApp(pool) {
  return createApp({
    pool,
    requireAuthMiddleware(req, _res, next) {
      req.user = { sub: "user-1" };
      next();
    }
  });
}

describe("invite routes", () => {
  it("accepts a pending invite and grants access to the list", async () => {
    const queries = [];
    const pool = {
      async query(text, params) {
        queries.push([normalizeSql(text), params]);

        if (text.includes("FROM list_invites")) {
          return {
            rows: [
              {
                id: "invite-1",
                list_id: "list-1",
                status: "pending"
              }
            ]
          };
        }

        if (text.includes("SELECT user_id FROM list_members")) {
          return { rows: [] };
        }

        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/invites/invite-token-1");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { listId: "list-1" });
    assert.match(queries[0][0], /FROM list_invites/);
    assert.equal(queries[0][1][0], "invite-token-1");
    assert.equal(queries[0][1][1] instanceof Date, true);
    assert.match(queries[1][0], /SELECT user_id FROM list_members/);
    assert.deepEqual(queries[1][1], ["list-1", "user-1"]);
    assert.match(queries[2][0], /INSERT INTO list_members/);
    assert.deepEqual(queries[2][1], ["list-1", "user-1"]);
    assert.match(queries[3][0], /UPDATE list_invites/);
    assert.deepEqual(queries[3][1], ["invite-1"]);
  });

  it("returns the list id when the invited user is already a member", async () => {
    let updateParams = null;
    const pool = {
      async query(text, params) {
        if (text.includes("FROM list_invites")) {
          return {
            rows: [
              {
                id: "invite-2",
                list_id: "list-9",
                status: "pending"
              }
            ]
          };
        }

        if (text.includes("SELECT user_id FROM list_members")) {
          return { rows: [{ user_id: "user-1" }] };
        }

        if (text.includes("UPDATE list_invites")) {
          updateParams = params;
        }

        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/invites/already-member-token");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { listId: "list-9" });
    assert.deepEqual(updateParams, ["invite-2"]);
  });

  it("rejects invalid or expired invites", async () => {
    const pool = {
      async query() {
        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/invites/expired-token");

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      error: "Invitation link is invalid or has expired."
    });
  });
});

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}
