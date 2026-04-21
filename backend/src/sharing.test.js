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

describe("sharing routes", () => {
  it("returns owner and members for an owned list", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return {
            rows: [
              {
                id: "list-1",
                owner_id: "user-1",
                owner_display_name: "Demo User",
                owner_email: "demo@example.com",
                created_at: "2026-04-21T00:00:00Z"
              }
            ]
          };
        }

        return {
          rows: [
            {
              user_id: "user-2",
              display_name: "Alex",
              email: "alex@example.com",
              joined_at: "2026-04-21T01:00:00Z"
            }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).get("/api/lists/list-1/members");

    assert.equal(response.status, 200);
    assert.equal(response.body.members.length, 2);
    assert.equal(response.body.members[0].is_owner, true);
    assert.equal(response.body.members[1].email, "alex@example.com");
  });

  it("shares a list with a registered user by email", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return {
            rows: [
              {
                id: "list-1",
                owner_id: "user-1",
                owner_display_name: "Demo User",
                owner_email: "demo@example.com",
                created_at: "2026-04-21T00:00:00Z"
              }
            ]
          };
        }

        if (callCount === 2) {
          return {
            rows: [{ id: "user-2", display_name: "Alex", email: "alex@example.com" }]
          };
        }

        if (callCount === 3) {
          return { rows: [] };
        }

        return {
          rows: [{ joined_at: "2026-04-21T01:00:00Z" }]
        };
      }
    };

    const response = await request(createAuthedApp(pool))
      .post("/api/lists/list-1/members")
      .send({ email: "alex@example.com" });

    assert.equal(response.status, 201);
    assert.equal(response.body.member.user_id, "user-2");
    assert.equal(response.body.member.is_owner, false);
  });

  it("returns 404 when the share email does not match a user", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return {
            rows: [
              {
                id: "list-1",
                owner_id: "user-1",
                owner_display_name: "Demo User",
                owner_email: "demo@example.com",
                created_at: "2026-04-21T00:00:00Z"
              }
            ]
          };
        }

        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool))
      .post("/api/lists/list-1/members")
      .send({ email: "missing@example.com" });

    assert.equal(response.status, 404);
  });

  it("returns 409 when the user already has access", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return {
            rows: [
              {
                id: "list-1",
                owner_id: "user-1",
                owner_display_name: "Demo User",
                owner_email: "demo@example.com",
                created_at: "2026-04-21T00:00:00Z"
              }
            ]
          };
        }

        if (callCount === 2) {
          return {
            rows: [{ id: "user-2", display_name: "Alex", email: "alex@example.com" }]
          };
        }

        return { rows: [{ user_id: "user-2" }] };
      }
    };

    const response = await request(createAuthedApp(pool))
      .post("/api/lists/list-1/members")
      .send({ email: "alex@example.com" });

    assert.equal(response.status, 409);
  });

  it("revokes a shared member", async () => {
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return {
            rows: [
              {
                id: "list-1",
                owner_id: "user-1",
                owner_display_name: "Demo User",
                owner_email: "demo@example.com",
                created_at: "2026-04-21T00:00:00Z"
              }
            ]
          };
        }

        return { rows: [{ user_id: "user-2" }] };
      }
    };

    const response = await request(createAuthedApp(pool)).delete("/api/lists/list-1/members/user-2");

    assert.equal(response.status, 204);
  });

  it("rejects removing the owner from their own list", async () => {
    const pool = {
      async query() {
        return {
          rows: [
            {
              id: "list-1",
              owner_id: "user-1",
              owner_display_name: "Demo User",
              owner_email: "demo@example.com",
              created_at: "2026-04-21T00:00:00Z"
            }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool)).delete("/api/lists/list-1/members/user-1");

    assert.equal(response.status, 400);
  });
});
