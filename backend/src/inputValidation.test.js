import { describe, it } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import request from "supertest";
import { createApp } from "./app.js";

const USER = "30000000-0000-4000-8000-000000000001";
const OWNER = "30000000-0000-4000-8000-000000000002";
const LIST = "10000000-0000-4000-8000-000000000001";
const ENTRY = "20000000-0000-4000-8000-000000000001";

const silent = pino({ level: "silent" });
const normalize = (sql) => sql.replace(/\s+/g, " ").trim();

/** Pool fake that records every statement (including transaction control) and answers via `answer`. */
function createPool(answer) {
  const statements = [];
  const run = async (sql, params) => {
    const text = normalize(sql);
    statements.push([text, params]);
    return (await answer(text, params)) ?? { rows: [] };
  };

  return {
    statements,
    query: run,
    async connect() {
      return { query: run, release() {} };
    }
  };
}

function createTestApp(pool, options = {}) {
  return createApp({
    pool,
    startWorkers: false,
    logger: silent,
    sseManager: { async broadcastToList() {}, async sendToUsers() {} },
    config: { jwtSecret: "test-secret-0123456789abcdef0123456789", jwtExpiresIn: "7d", registrationEnabled: true },
    requireAuthMiddleware(req, _res, next) {
      req.user = { sub: USER };
      next();
    },
    ...options
  });
}

const failingMailer = {
  async send() {
    throw new Error("SMTP unreachable");
  }
};

describe("malformed identifiers", () => {
  const cases = [
    ["get", "/api/lists/not-a-uuid/entries", "List not found."],
    ["post", "/api/lists/not-a-uuid/entries", "List not found."],
    ["patch", `/api/lists/${LIST}/entries/not-a-uuid`, "Entry not found."],
    ["delete", `/api/lists/${LIST}/entries/not-a-uuid`, "Entry not found."],
    ["delete", `/api/lists/not-a-uuid/members/${USER}`, "List not found."],
    ["delete", `/api/lists/${LIST}/members/not-a-uuid`, "That member does not have access to this list."],
    ["get", "/api/lists/not-a-uuid/history", "List not found."],
    ["patch", "/api/lists/not-a-uuid", "List not found."],
    ["delete", "/api/lists/not-a-uuid", "List not found."],
    ["delete", "/api/lists/not-a-uuid/leave", "List not found."],
    ["post", "/api/lists/not-a-uuid/mark-viewed", "List not found."]
  ];

  for (const [method, path, message] of cases) {
    it(`answers ${method.toUpperCase()} ${path} with 404 and runs no query`, async () => {
      const pool = createPool(() => {
        throw new Error("no query expected");
      });

      const response = await request(createTestApp(pool))[method](path).send({ text: "x", name: "x", email: "a@b.c" });

      assert.equal(response.status, 404);
      assert.deepEqual(response.body, { error: message });
      assert.deepEqual(pool.statements, []);
    });
  }

  it("answers 400 for an invite token that is not a UUID without querying", async () => {
    const pool = createPool(() => {
      throw new Error("no query expected");
    });

    const response = await request(createTestApp(pool)).get("/api/invites/not-a-uuid");

    assert.equal(response.status, 400);
    assert.equal(pool.statements.length, 0);
  });

  it("answers 401 for an API key that is not a UUID without querying", async () => {
    const pool = createPool(() => {
      throw new Error("no query expected");
    });

    const response = await request(createTestApp(pool)).get("/api/v1/lists").set("X-Api-Key", "not-a-uuid");

    assert.equal(response.status, 401);
    assert.equal(pool.statements.length, 0);
  });
});

describe("database error mapping", () => {
  const failWith = (code) =>
    createPool(() => {
      const error = new Error(`pg ${code}`);
      error.code = code;
      throw error;
    });

  for (const [code, status] of [
    ["22P02", 400],
    ["23505", 409],
    ["23503", 404],
    ["XX000", 500]
  ]) {
    it(`maps ${code} to ${status}`, async () => {
      const response = await request(createTestApp(failWith(code))).get(`/api/lists/${LIST}/entries`);

      assert.equal(response.status, status);
      assert.equal(typeof response.body.error, "string");
      assert.equal(response.body.error.includes("pg "), false);
    });
  }
});

describe("done transition", () => {
  const patchDone = (pool) =>
    request(createTestApp(pool)).patch(`/api/lists/${LIST}/entries/${ENTRY}`).send({ status: "done" });

  function entriesPool({ entryStatus, doneCount = 200 }) {
    return createPool((sql) => {
      if (sql.startsWith("SELECT l.id")) return { rows: [{ id: LIST }] };
      if (sql.startsWith("SELECT status FROM entries")) return { rows: entryStatus ? [{ status: entryStatus }] : [] };
      if (sql.includes("COUNT(*)")) return { rows: [{ cnt: String(doneCount) }] };
      if (sql.startsWith("UPDATE entries")) return { rows: [{ id: ENTRY, list_id: LIST, status: "done" }] };
      return { rows: [] };
    });
  }

  it("deletes nothing and answers 404 for an unknown entry at the done limit", async () => {
    const pool = entriesPool({ entryStatus: null });

    const response = await patchDone(pool);

    assert.equal(response.status, 404);
    assert.equal(pool.statements.some(([sql]) => sql.startsWith("DELETE")), false);
    assert.equal(pool.statements.at(-1)[0], "COMMIT");
  });

  it("does not evict anything when the entry is already done", async () => {
    const pool = entriesPool({ entryStatus: "done" });

    const response = await patchDone(pool);

    assert.equal(response.status, 200);
    assert.equal(pool.statements.some(([sql]) => sql.startsWith("DELETE")), false);
  });

  it("evicts the oldest done entry, never the target, when an open entry completes at the limit", async () => {
    const pool = entriesPool({ entryStatus: "open" });

    const response = await patchDone(pool);

    assert.equal(response.status, 200);
    const eviction = pool.statements.find(([sql]) => sql.startsWith("DELETE FROM entries"));
    assert.match(eviction[0], /status = 'done' AND id <> \$2/);
    assert.deepEqual(eviction[1], [LIST, ENTRY]);
  });

  it("rolls the transaction back when a statement fails", async () => {
    const pool = createPool((sql) => {
      if (sql.startsWith("SELECT l.id")) return { rows: [{ id: LIST }] };
      if (sql.startsWith("SELECT status FROM entries")) throw new Error("boom");
      return { rows: [] };
    });

    const response = await patchDone(pool);

    assert.equal(response.status, 500);
    assert.equal(pool.statements.at(-1)[0], "ROLLBACK");
  });
});

describe("mail failures after a committed change", () => {
  const ownedList = {
    id: LIST,
    name: "Groceries",
    owner_id: USER,
    created_at: "now",
    owner_display_name: "Owner",
    owner_email: "owner@example.test"
  };

  it("still answers 204 when the revocation mail fails", async () => {
    const pool = createPool((sql) => {
      if (sql.includes("FROM lists l JOIN users owner")) return { rows: [ownedList] };
      if (sql.startsWith("DELETE FROM list_members")) {
        return { rows: [{ user_id: OWNER, email: "member@example.test", display_name: "Member" }] };
      }
    });

    const response = await request(createTestApp(pool, { mailer: failingMailer })).delete(
      `/api/lists/${LIST}/members/${OWNER}`
    );

    assert.equal(response.status, 204);
  });

  it("still answers 204 when the member-left mail fails", async () => {
    const pool = createPool((sql) => {
      if (sql.includes("JOIN users owner")) {
        return {
          rows: [{ ...ownedList, owner_id: OWNER }]
        };
      }
      if (sql.startsWith("DELETE FROM list_members")) {
        return { rows: [{ user_id: USER, display_name: "Me" }] };
      }
    });

    const response = await request(createTestApp(pool, { mailer: failingMailer })).delete(`/api/lists/${LIST}/leave`);

    assert.equal(response.status, 204);
  });

  it("still answers 201 when the invite mail fails", async () => {
    const pool = createPool((sql) => {
      if (sql.includes("FROM lists l JOIN users owner")) return { rows: [ownedList] };
      if (sql.startsWith("INSERT INTO list_invites")) {
        return { rows: [{ id: "i1", invited_email: "new@example.test", status: "pending", expires_at: "later" }] };
      }
    });

    const response = await request(createTestApp(pool, { mailer: failingMailer }))
      .post(`/api/lists/${LIST}/members`)
      .send({ email: "new@example.test" });

    assert.equal(response.status, 201);
  });

  it("still answers 201 when the verification mail fails and registers in one transaction", async () => {
    const pool = createPool((sql) => {
      if (sql.startsWith("INSERT INTO users")) {
        return { rows: [{ id: USER, email: "n@example.test", display_name: "N", created_at: "now" }] };
      }
    });

    const response = await request(createTestApp(pool, { mailer: failingMailer }))
      .post("/api/auth/register")
      .send({ email: "n@example.test", password: "long-enough-password", display_name: "N" });

    assert.equal(response.status, 201);
    assert.deepEqual(
      pool.statements.map(([sql]) => sql.split(" ").slice(0, 3).join(" ")),
      ["BEGIN", "INSERT INTO users", "INSERT INTO email_verification_tokens", "COMMIT"]
    );
  });

  it("rolls registration back, and sends no mail, when the verification token cannot be stored", async () => {
    const pool = createPool((sql) => {
      if (sql.startsWith("INSERT INTO users")) {
        return { rows: [{ id: USER, email: "n@example.test", display_name: "N", created_at: "now" }] };
      }
      if (sql.startsWith("INSERT INTO email_verification_tokens")) {
        throw new Error("disk full");
      }
    });
    let mailSent = false;

    const response = await request(
      createTestApp(pool, {
        mailer: {
          async send() {
            mailSent = true;
          }
        }
      })
    )
      .post("/api/auth/register")
      .send({ email: "n@example.test", password: "long-enough-password", display_name: "N" });

    assert.equal(response.status, 500);
    assert.equal(pool.statements.at(-1)[0], "ROLLBACK");
    assert.equal(mailSent, false);
  });

  it("still answers 200 when the password reset mail fails", async () => {
    const pool = createPool((sql) => {
      if (sql.startsWith("SELECT id, email, display_name, email_verified")) {
        return { rows: [{ id: USER, email: "n@example.test", display_name: "N", email_verified: true }] };
      }
    });

    const response = await request(createTestApp(pool, { mailer: failingMailer }))
      .post("/api/auth/forgot-password")
      .send({ email: "n@example.test" });

    assert.equal(response.status, 200);
  });
});
