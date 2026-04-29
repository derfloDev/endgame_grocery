import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app.js";

function createAuthedApp(pool, options = {}) {
  return createApp({
    pool,
    config: {
      appBaseUrl: "https://app.example.com",
      ...options.config
    },
    mailer: options.mailer,
    sseManager: options.sseManager ?? createSseManagerSpy(),
    generateInviteToken: options.generateInviteToken,
    now: options.now,
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
                name: "Weekly groceries",
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

  it("creates an invite and sends an existing-user mail", async () => {
    const sentMessages = [];
    let callCount = 0;
    let inviteInsertParams = null;
    const pool = {
      async query(text, params) {
        callCount += 1;

        if (callCount === 1) {
          return {
            rows: [
              {
                id: "list-1",
                name: "Weekly groceries",
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

        if (callCount === 4) {
          inviteInsertParams = params;
          return {
            rows: [
              {
                id: "invite-1",
                invited_email: "alex@example.com",
                status: "pending",
                expires_at: "2026-04-28T00:00:00Z"
              }
            ]
          };
        }

        throw new Error(`Unexpected query: ${text}`);
      }
    };

    const response = await request(
      createAuthedApp(pool, {
        mailer: {
          async send(message) {
            sentMessages.push(message);
          }
        },
        generateInviteToken() {
          return "invite-token-1";
        },
        now() {
          return new Date("2026-04-21T00:00:00Z");
        }
      })
    )
      .post("/api/lists/list-1/members")
      .send({ email: "alex@example.com" });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      invite: {
        id: "invite-1",
        invited_email: "alex@example.com",
        status: "pending",
        expires_at: "2026-04-28T00:00:00Z"
      }
    });
    assert.deepEqual(inviteInsertParams, [
      "list-1",
      "alex@example.com",
      "user-1",
      "invite-token-1",
      new Date("2026-04-28T00:00:00.000Z")
    ]);
    assert.deepEqual(sentMessages, [
      {
        to: "alex@example.com",
        subject: "Demo User shared Weekly groceries with you",
        template: "invite-existing",
        context: {
          heading: "Demo User shared a list with you",
          intro: "Hi Alex,",
          body: "Open the invite below to access the shared list \"Weekly groceries\".",
          ctaLabel: "View list",
          ctaUrl: "https://app.example.com/invite/invite-token-1",
          listName: "Weekly groceries",
          inviterName: "Demo User"
        }
      }
    ]);
  });

  it("creates an invite for a new email address and sends the signup mail", async () => {
    const sentMessages = [];
    let callCount = 0;
    const pool = {
      async query(text) {
        callCount += 1;

        if (callCount === 1) {
          return {
            rows: [
              {
                id: "list-1",
                name: "Weekly groceries",
                owner_id: "user-1",
                owner_display_name: "Demo User",
                owner_email: "demo@example.com",
                created_at: "2026-04-21T00:00:00Z"
              }
            ]
          };
        }

        if (callCount === 2) {
          return { rows: [] };
        }

        if (callCount === 3) {
          return {
            rows: [
              {
                id: "invite-2",
                invited_email: "new@example.com",
                status: "pending",
                expires_at: "2026-04-28T00:00:00Z"
              }
            ]
          };
        }

        throw new Error(`Unexpected query: ${text}`);
      }
    };

    const response = await request(
      createAuthedApp(pool, {
        mailer: {
          async send(message) {
            sentMessages.push(message);
          }
        },
        generateInviteToken() {
          return "invite-token-new";
        },
        now() {
          return new Date("2026-04-21T00:00:00Z");
        }
      })
    )
      .post("/api/lists/list-1/members")
      .send({ email: "new@example.com" });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, {
      invite: {
        id: "invite-2",
        invited_email: "new@example.com",
        status: "pending",
        expires_at: "2026-04-28T00:00:00Z"
      }
    });
    assert.deepEqual(sentMessages, [
      {
        to: "new@example.com",
        subject: "Demo User invited you to Weekly groceries",
        template: "invite-new",
        context: {
          heading: "You are invited to Endgame Grocery",
          intro: "Hi there,",
          body: "Create your account to join the shared list \"Weekly groceries\".",
          ctaLabel: "Register",
          ctaUrl: "https://app.example.com/register?invite=invite-token-new",
          listName: "Weekly groceries",
          inviterName: "Demo User"
        }
      }
    ]);
  });

  it("resets an existing pending invite token when reinviting the same email", async () => {
    const sentMessages = [];
    let callCount = 0;
    let inviteInsertParams = null;
    const pool = {
      async query(text, params) {
        callCount += 1;

        if (callCount === 1) {
          return {
            rows: [
              {
                id: "list-1",
                name: "Weekly groceries",
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

        inviteInsertParams = params;
        return {
          rows: [
            {
              id: "invite-1",
              invited_email: "alex@example.com",
              status: "pending",
              expires_at: "2026-04-28T00:00:00Z"
            }
          ]
        };
      }
    };

    const response = await request(
      createAuthedApp(pool, {
        mailer: {
          async send(message) {
            sentMessages.push(message);
          }
        },
        generateInviteToken() {
          return "fresh-invite-token";
        },
        now() {
          return new Date("2026-04-21T00:00:00Z");
        }
      })
    )
      .post("/api/lists/list-1/members")
      .send({ email: "alex@example.com" });

    assert.equal(response.status, 201);
    assert.equal(response.body.invite.id, "invite-1");
    assert.equal(response.body.invite.status, "pending");
    assert.deepEqual(inviteInsertParams, [
      "list-1",
      "alex@example.com",
      "user-1",
      "fresh-invite-token",
      new Date("2026-04-28T00:00:00.000Z")
    ]);
    assert.equal(sentMessages[0].context.ctaUrl, "https://app.example.com/invite/fresh-invite-token");
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
                name: "Weekly groceries",
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

  it("revokes a shared member and sends a revocation mail", async () => {
    const sseManager = createSseManagerSpy();
    const sentMessages = [];
    let callCount = 0;
    const pool = {
      async query() {
        callCount += 1;

        if (callCount === 1) {
          return {
            rows: [
              {
                id: "list-1",
                name: "Weekly groceries",
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
              email: "alex@example.com",
              display_name: "Alex"
            }
          ]
        };
      }
    };

    const response = await request(
      createAuthedApp(pool, {
        mailer: {
          async send(message) {
            sentMessages.push(message);
          }
        },
        sseManager
      })
    ).delete("/api/lists/list-1/members/user-2");

    assert.equal(response.status, 204);
    assert.deepEqual(sentMessages, [
      {
        to: "alex@example.com",
        subject: "Your access to Weekly groceries was removed",
        template: "revocation",
        context: {
          heading: "List access removed",
          intro: "Hi Alex,",
          body: "Your collaboration on the list \"Weekly groceries\" has ended.",
          listName: "Weekly groceries"
        }
      }
    ]);
    assert.deepEqual(sseManager.calls, [
      ["list-1", "member:removed", { listId: "list-1", userId: "user-2" }]
    ]);
  });

  it("rejects removing the owner from their own list", async () => {
    const sseManager = createSseManagerSpy();
    const pool = {
      async query() {
        return {
          rows: [
            {
              id: "list-1",
              name: "Weekly groceries",
              owner_id: "user-1",
              owner_display_name: "Demo User",
              owner_email: "demo@example.com",
              created_at: "2026-04-21T00:00:00Z"
            }
          ]
        };
      }
    };

    const response = await request(createAuthedApp(pool, { sseManager })).delete(
      "/api/lists/list-1/members/user-1"
    );

    assert.equal(response.status, 400);
    assert.deepEqual(sseManager.calls, []);
  });
});

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
