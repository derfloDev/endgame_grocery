import { describe, it } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import request from "supertest";
import { createApp } from "./app.js";
import { withTransactions } from "./testHelpers.js";

const silentLogger = pino({ level: "silent" });

function emptyPool() {
  const query = async () => ({ rows: [] });

  return { query, async connect() { return { query, release() {} }; } };
}

function createTestApp({ pool, bcryptLib, rateLimits, requireAuthMiddleware, mailer } = {}) {
  return createApp({
    pool: withTransactions(pool ?? emptyPool()),
    startWorkers: false,
    logger: silentLogger,
    config: { jwtSecret: "test-secret-0123456789abcdef0123456789", jwtExpiresIn: "7d", registrationEnabled: true },
    ...(bcryptLib ? { bcryptLib } : {}),
    ...(rateLimits ? { rateLimits } : {}),
    ...(requireAuthMiddleware ? { requireAuthMiddleware } : {}),
    mailer: mailer ?? { async send() {} }
  });
}

function login(app, email, ip = "10.0.0.1") {
  return request(app)
    .post("/api/auth/login")
    .set("X-Forwarded-For", ip)
    .send({ email, password: "wrong-password" });
}

describe("proxy and header hardening", () => {
  it("trusts exactly one proxy hop and hides the framework header", async () => {
    const app = createTestApp();
    const response = await request(app).get("/api/health");

    assert.equal(app.get("trust proxy"), 1);
    assert.equal(response.headers["x-powered-by"], undefined);
  });

  it("keys rate limits on the client address forwarded by the proxy", async () => {
    const app = createTestApp({ rateLimits: { login: { limit: 2 } } });

    // Two clients behind the same proxy get independent counters.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      assert.equal((await login(app, `a${attempt}@example.com`, "10.0.0.1")).status, 401);
    }
    assert.equal((await login(app, "a2@example.com", "10.0.0.1")).status, 429);
    assert.equal((await login(app, "b0@example.com", "10.0.0.2")).status, 401);
  });
});

describe("login rate limit", () => {
  it("answers the 6th failed login from one IP with 429 and Retry-After", async () => {
    const app = createTestApp();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await login(app, `user${attempt}@example.com`);
      assert.equal(response.status, 401, `attempt ${attempt}`);
    }

    const blocked = await login(app, "user6@example.com");

    assert.equal(blocked.status, 429);
    assert.match(blocked.body.error, /too many/i);
    assert.ok(Number(blocked.headers["retry-after"]) > 0);
    assert.ok(Number(blocked.headers["retry-after"]) <= 15 * 60);
  });

  it("answers the 6th failed login for one email from different IPs with 429", async () => {
    const app = createTestApp();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await login(app, "Victim@Example.com", `10.0.1.${attempt}`);
      assert.equal(response.status, 401, `attempt ${attempt}`);
    }

    // The email limit is case-insensitive and independent of the IP.
    const blocked = await login(app, "victim@example.com", "10.0.1.99");

    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers["retry-after"]) > 0);
  });

  it("does not count successful logins", async () => {
    const pool = {
      async query() {
        return {
          rows: [{ id: "user-1", email: "a@example.com", display_name: "A", password_hash: "hash", email_verified: true }]
        };
      }
    };
    const app = createTestApp({
      pool: withTransactions(pool),
      bcryptLib: { async compare() { return true; }, async hash() { return "hash"; } }
    });

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "a@example.com", password: "password123" });
      assert.equal(response.status, 200, `attempt ${attempt}`);
    }
  });

  it("compares against a dummy hash when the user does not exist", async () => {
    const comparisons = [];
    const app = createTestApp({
      bcryptLib: {
        async compare(password, hash) {
          comparisons.push({ password, hash });
          return false;
        },
        async hash() { return "hash"; }
      }
    });

    const response = await login(app, "nobody@example.com");

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Invalid email or password.", code: "auth.invalid_credentials" });
    assert.equal(comparisons.length, 1);
    assert.equal(comparisons[0].password, "wrong-password");
    // A well-formed cost-12 hash makes the unknown-user path as slow as a real check.
    assert.match(comparisons[0].hash, /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/);
  });
});

describe("rate limits in the E2E configuration", () => {
  it("are skipped when test routes are enabled, because the E2E suite shares one IP", async () => {
    const app = createApp({
      pool: { async query() { return { rows: [] }; } },
      startWorkers: false,
      logger: silentLogger,
      config: { jwtSecret: "test-secret-0123456789abcdef0123456789", enableTestRoutes: true },
      mailer: { async send() {} }
    });

    for (let attempt = 1; attempt <= 8; attempt += 1) {
      const response = await login(app, `user${attempt}@example.com`);
      assert.equal(response.status, 401, `attempt ${attempt}`);
    }
  });

  it("stay active in the normal configuration", async () => {
    const app = createTestApp();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await login(app, `user${attempt}@example.com`);
    }

    assert.equal((await login(app, "user6@example.com")).status, 429);
  });
});

describe("mail endpoint rate limits", () => {
  const cases = [
    {
      name: "register",
      path: "/api/auth/register",
      body: (n) => ({ email: `new${n}@example.com`, password: "password123", display_name: "New" })
    },
    { name: "forgot-password", path: "/api/auth/forgot-password", body: (n) => ({ email: `new${n}@example.com` }) },
    { name: "resend-verification", path: "/api/auth/resend-verification", body: (n) => ({ email: `new${n}@example.com` }) }
  ];

  for (const { name, path, body } of cases) {
    it(`limits ${name} to 5 per hour per IP`, async () => {
      const app = createTestApp();

      for (let n = 1; n <= 5; n += 1) {
        const response = await request(app).post(path).send(body(n));
        assert.notEqual(response.status, 429, `request ${n}`);
      }

      const blocked = await request(app).post(path).send(body(6));
      assert.equal(blocked.status, 429);
      assert.ok(Number(blocked.headers["retry-after"]) > 0);
      assert.ok(Number(blocked.headers["retry-after"]) <= 60 * 60);
    });

    it(`limits ${name} to 5 per hour per email across IPs`, async () => {
      const app = createTestApp();
      const sameEmail = { ...body(1), email: "Same@Example.com" };

      for (let n = 1; n <= 5; n += 1) {
        const response = await request(app).post(path).set("X-Forwarded-For", `10.0.2.${n}`).send(sameEmail);
        assert.notEqual(response.status, 429, `request ${n}`);
      }

      const blocked = await request(app).post(path).set("X-Forwarded-For", "10.0.2.99").send({ ...sameEmail, email: "same@example.com" });
      assert.equal(blocked.status, 429);
    });
  }

  it("limits reset-password to 10 per hour per IP", async () => {
    const app = createTestApp();

    for (let n = 1; n <= 10; n += 1) {
      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: `token-${n}`, password: "new-password-123" });
      assert.equal(response.status, 400, `request ${n}`);
    }

    const blocked = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "token-11", password: "new-password-123" });
    assert.equal(blocked.status, 429);
  });

  it("limits invitations to 20 per hour per user, counted separately for every user", async () => {
    const requireAuthMiddleware = (req, _res, next) => {
      req.user = { sub: req.headers["x-test-user"] };
      next();
    };
    const app = createTestApp({ requireAuthMiddleware, rateLimits: { invite: { limit: 2 } } });
    const invite = (user) =>
      request(app).post("/api/lists/10000000-0000-4000-8000-000000000001/members").set("X-Test-User", user).send({});

    assert.notEqual((await invite("user-1")).status, 429);
    assert.notEqual((await invite("user-1")).status, 429);
    const blocked = await invite("user-1");
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers["retry-after"]) > 0);
    assert.notEqual((await invite("user-2")).status, 429);
  });

  it("uses the documented default of 20 invitations per hour", async () => {
    const { DEFAULT_RATE_LIMITS } = await import("./middleware/rateLimit.js");

    assert.deepEqual(DEFAULT_RATE_LIMITS.invite, { limit: 20, windowMs: 60 * 60 * 1000 });
    assert.deepEqual(DEFAULT_RATE_LIMITS.login, { limit: 5, windowMs: 15 * 60 * 1000 });
    assert.deepEqual(DEFAULT_RATE_LIMITS.resetPassword, { limit: 10, windowMs: 60 * 60 * 1000 });
  });
});

describe("password policy on the API", () => {
  function recordingBcrypt() {
    const calls = [];
    return {
      calls,
      lib: {
        async hash(password) {
          calls.push(password);
          return "hash";
        },
        async compare() { return false; }
      }
    };
  }

  const invalidPasswords = {
    "shorter than 8 characters": "1234567",
    "longer than 72 bytes": "a".repeat(73),
    "longer than 72 bytes in multi-byte characters": "ä".repeat(37),
    "not a string": 12345678
  };

  for (const [name, password] of Object.entries(invalidPasswords)) {
    it(`rejects a registration password ${name}`, async () => {
      const bcrypt = recordingBcrypt();
      let queried = false;
      const app = createTestApp({
        pool: { async query() { queried = true; return { rows: [] }; } },
        bcryptLib: bcrypt.lib
      });

      const response = await request(app)
        .post("/api/auth/register")
        .send({ email: "new@example.com", password, display_name: "New" });

      assert.equal(response.status, 400);
      assert.match(response.body.error, /password/i);
      assert.equal(queried, false);
      assert.deepEqual(bcrypt.calls, []);
    });

    it(`rejects a reset password ${name} before touching the token`, async () => {
      const bcrypt = recordingBcrypt();
      let queried = false;
      const app = createTestApp({
        pool: { async query() { queried = true; return { rows: [] }; } },
        bcryptLib: bcrypt.lib
      });

      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: "reset-token", password });

      assert.equal(response.status, 400);
      assert.match(response.body.error, /password/i);
      assert.equal(queried, false);
      assert.deepEqual(bcrypt.calls, []);
    });
  }

  it("still accepts a password at the 72-byte limit", async () => {
    const bcrypt = recordingBcrypt();
    const app = createTestApp({
      pool: { async query() { return { rows: [{ id: "u1", email: "new@example.com", display_name: "New", created_at: "now" }] }; } },
      bcryptLib: bcrypt.lib
    });

    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "new@example.com", password: "a".repeat(72), display_name: "New" });

    assert.equal(response.status, 201);
    assert.equal(bcrypt.calls.length, 1);
  });
});
