import { describe, it } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import pino from "pino";
import request from "supertest";
import { createApp } from "./app.js";
import { createRequireAuth, createRequireAuthFn } from "./middleware/auth.js";
import { withTransaction } from "./db/client.js";

const secret = "revocation-test-secret-0123456789abcdef0123456789";
const config = { jwtSecret: secret, jwtExpiresIn: "7d" };

function sign(payload) {
  return jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "1h" });
}

function createPool(rows) {
  const queries = [];
  return {
    queries,
    async query(text, params) {
      queries.push([text.replace(/\s+/g, " ").trim(), params]);
      return { rows: typeof rows === "function" ? rows(text, params) : rows };
    }
  };
}

function runMiddleware(middleware, token) {
  return new Promise((resolve, reject) => {
    const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body, req, nextCalled: false });
      }
    };
    Promise.resolve(middleware(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ status: 200, req, nextCalled: true });
    })).catch(reject);
  });
}

describe("requireAuth token version check", () => {
  it("accepts a token whose tv matches the stored token_version", async () => {
    const pool = createPool([{ token_version: 3 }]);
    const result = await runMiddleware(createRequireAuth({ config, pool }), sign({ sub: "user-1", tv: 3 }));

    assert.equal(result.nextCalled, true);
    assert.equal(result.req.user.sub, "user-1");
    assert.match(pool.queries[0][0], /SELECT token_version FROM users WHERE id = \$1/);
    assert.deepEqual(pool.queries[0][1], ["user-1"]);
  });

  it("rejects a token issued before the version was bumped", async () => {
    const pool = createPool([{ token_version: 4 }]);
    const result = await runMiddleware(createRequireAuth({ config, pool }), sign({ sub: "user-1", tv: 3 }));

    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { error: "Authentication token is invalid." });
  });

  it("treats a token without tv as version 0", async () => {
    const accepted = await runMiddleware(
      createRequireAuth({ config, pool: createPool([{ token_version: 0 }]) }),
      sign({ sub: "user-1" })
    );
    const rejected = await runMiddleware(
      createRequireAuth({ config, pool: createPool([{ token_version: 1 }]) }),
      sign({ sub: "user-1" })
    );

    assert.equal(accepted.nextCalled, true);
    assert.equal(rejected.status, 401);
  });

  it("rejects a token of a user that no longer exists", async () => {
    const result = await runMiddleware(createRequireAuth({ config, pool: createPool([]) }), sign({ sub: "gone", tv: 0 }));

    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { error: "Authentication token is invalid." });
  });

  it("does not query the database for an invalid or missing JWT", async () => {
    const pool = createPool([{ token_version: 0 }]);
    const middleware = createRequireAuth({ config, pool });

    assert.equal((await runMiddleware(middleware, "not-a-jwt")).status, 401);
    assert.equal((await runMiddleware(middleware, undefined)).status, 401);
    assert.equal(pool.queries.length, 0);
  });

  it("passes database errors on instead of treating them as an authentication result", async () => {
    const pool = {
      async query() {
        throw new Error("connection lost");
      }
    };

    await assert.rejects(
      runMiddleware(createRequireAuth({ config, pool }), sign({ sub: "user-1", tv: 0 })),
      /connection lost/
    );
  });

  it("only verifies the signature when no pool is available", async () => {
    const result = await runMiddleware(createRequireAuth({ config }), sign({ sub: "user-1", tv: 9 }));

    assert.equal(result.nextCalled, true);
  });
});

describe("requireAuthFn token version check", () => {
  it("returns the payload for a current token and rejects a revoked one", async () => {
    const current = createRequireAuthFn({ config, pool: createPool([{ token_version: 2 }]) });

    assert.equal((await current(sign({ sub: "user-1", tv: 2 }))).sub, "user-1");
    await assert.rejects(current(sign({ sub: "user-1", tv: 1 })));
    await assert.rejects(current("not-a-jwt"));
  });
});

describe("routes use the token version check", () => {
  function createTestApp(rows) {
    const pool = createPool(rows);
    return {
      pool,
      app: createApp({ pool, startWorkers: false, logger: pino({ level: "silent" }), config })
    };
  }

  it("returns 401 on /api/auth/me for a token issued before a reset", async () => {
    const { app } = createTestApp((text) => (text.includes("token_version") ? [{ token_version: 1 }] : []));

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${sign({ sub: "user-1", tv: 0 })}`);

    assert.equal(response.status, 401);
  });

  it("returns 401 on a list route for a revoked token", async () => {
    const { app, pool } = createTestApp((text) => (text.includes("token_version") ? [{ token_version: 2 }] : []));

    const response = await request(app)
      .get("/api/lists")
      .set("Authorization", `Bearer ${sign({ sub: "user-1", tv: 1 })}`);

    assert.equal(response.status, 401);
    assert.equal(pool.queries.length, 1);
  });

  it("refuses to issue an event stream ticket for a revoked token", async () => {
    const { app } = createTestApp((text) => (text.includes("token_version") ? [{ token_version: 2 }] : []));

    const response = await request(app)
      .post("/api/events/ticket")
      .set("Authorization", `Bearer ${sign({ sub: "user-1", tv: 1 })}`);

    assert.equal(response.status, 401);
  });

  it("issues an event stream ticket for a current token", async () => {
    const { app } = createTestApp([{ token_version: 2 }]);

    const response = await request(app)
      .post("/api/events/ticket")
      .set("Authorization", `Bearer ${sign({ sub: "user-1", tv: 2 })}`);

    assert.equal(response.status, 200);
    assert.ok(response.body.ticket);
  });

  it("puts the stored token_version into the token returned by login", async () => {
    const appWithBcrypt = createApp({
      pool: createPool([
        { id: "user-1", email: "a@example.com", display_name: "A", password_hash: "hash", email_verified: true, token_version: 5 }
      ]),
      startWorkers: false,
      logger: pino({ level: "silent" }),
      config,
      bcryptLib: { async compare() { return true; }, async hash() { return "hash"; } }
    });

    const response = await request(appWithBcrypt)
      .post("/api/auth/login")
      .send({ email: "a@example.com", password: "password123" });

    assert.equal(response.status, 200);
    assert.equal(jwt.decode(response.body.token).tv, 5);
  });
});

describe("password reset", () => {
  function createResetApp({ claimRows = [{ user_id: "user-1" }], failOn } = {}) {
    const statements = [];
    let released = 0;
    const run = async (text, params) => {
      const sql = text.replace(/\s+/g, " ").trim();
      statements.push([sql, params]);

      if (failOn && sql.includes(failOn)) {
        throw new Error("boom");
      }

      if (sql.startsWith("UPDATE password_reset_tokens")) {
        return { rows: claimRows };
      }

      return { rows: [] };
    };
    const hashes = [];
    const pool = {
      query: run,
      async connect() {
        return { query: run, release() { released += 1; } };
      }
    };
    const app = createApp({
      pool,
      startWorkers: false,
      logger: pino({ level: "silent" }),
      config,
      now: () => new Date("2026-04-28T10:00:00Z"),
      bcryptLib: {
        async hash(password) {
          hashes.push(password);
          return "new-hash";
        },
        async compare() { return false; }
      }
    });

    return { app, statements, hashes, released: () => released };
  }

  const reset = (app, token = "reset-token") =>
    request(app).post("/api/auth/reset-password").send({ token, password: "new-password-123" });

  it("consumes the token with one conditional UPDATE and finishes in one transaction", async () => {
    const { app, statements, hashes, released } = createResetApp();

    const response = await reset(app);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { message: "Password updated." });
    assert.deepEqual(hashes, ["new-password-123"]);
    assert.equal(statements[0][0], "BEGIN");
    assert.match(
      statements[1][0],
      /^UPDATE password_reset_tokens SET used = true WHERE token = \$1 AND used = false AND expires_at > \$2 RETURNING user_id$/
    );
    assert.deepEqual(statements[1][1], ["reset-token", new Date("2026-04-28T10:00:00Z")]);
    assert.equal(statements.at(-1)[0], "COMMIT");
    assert.equal(released(), 1);
  });

  it("changes the password, bumps token_version and clears the API key together", async () => {
    const { app, statements } = createResetApp();

    await reset(app);

    const update = statements.find(([sql]) => sql.startsWith("UPDATE users"));
    assert.match(update[0], /SET password_hash = \$1, token_version = token_version \+ 1, api_key = NULL WHERE id = \$2/);
    assert.deepEqual(update[1], ["new-hash", "user-1"]);
  });

  it("invalidates the user's other reset tokens", async () => {
    const { app, statements } = createResetApp();

    await reset(app);

    const cleanup = statements.find(([sql]) => sql.startsWith("DELETE FROM password_reset_tokens"));
    assert.match(cleanup[0], /WHERE user_id = \$1 AND token <> \$2/);
    assert.deepEqual(cleanup[1], ["user-1", "reset-token"]);
  });

  it("answers 400 without changing anything when the token was already claimed", async () => {
    const { app, statements, hashes } = createResetApp({ claimRows: [] });

    const response = await reset(app);

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "Password reset link is invalid or has expired." });
    assert.deepEqual(hashes, []);
    assert.equal(statements.some(([sql]) => sql.startsWith("UPDATE users")), false);
  });

  it("rolls the whole reset back when a later statement fails", async () => {
    const { app, statements, released } = createResetApp({ failOn: "UPDATE users" });

    const response = await reset(app);

    assert.equal(response.status, 500);
    assert.equal(statements.at(-1)[0], "ROLLBACK");
    assert.equal(statements.some(([sql]) => sql === "COMMIT"), false);
    assert.equal(released(), 1);
  });
});

describe("withTransaction", () => {
  function createClientPool({ failOn } = {}) {
    const statements = [];
    let released = 0;
    const client = {
      async query(text) {
        statements.push(text);
        if (failOn && text.includes(failOn)) {
          throw new Error("boom");
        }
        return { rows: [] };
      },
      release() {
        released += 1;
      }
    };

    return { statements, released: () => released, pool: { async connect() { return client; } } };
  }

  it("commits and releases the client", async () => {
    const { pool, statements, released } = createClientPool();

    const result = await withTransaction(pool, async (client) => {
      await client.query("UPDATE x");
      return "done";
    });

    assert.equal(result, "done");
    assert.deepEqual(statements, ["BEGIN", "UPDATE x", "COMMIT"]);
    assert.equal(released(), 1);
  });

  it("rolls back, releases and rethrows when the callback fails", async () => {
    const { pool, statements, released } = createClientPool({ failOn: "UPDATE x" });

    await assert.rejects(withTransaction(pool, (client) => client.query("UPDATE x")), /boom/);

    assert.deepEqual(statements, ["BEGIN", "UPDATE x", "ROLLBACK"]);
    assert.equal(released(), 1);
  });
});
