import { describe, it } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "./app.js";

const secret = "test-secret";

function createTestApp(options = {}) {
  const pool = {
    async query() {
      return { rows: [] };
    }
  };

  return createApp({
    pool,
    config: { jwtSecret: secret, jwtExpiresIn: "7d", registrationEnabled: true },
    ...options
  });
}

function unsignedToken(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

const badTokens = {
  "an unsigned alg:none token": () => unsignedToken({ sub: "user-1" }),
  "a token signed with the wrong secret": () =>
    jwt.sign({ sub: "user-1" }, "another-secret", { algorithm: "HS256" }),
  "an expired token": () =>
    jwt.sign({ sub: "user-1", exp: Math.floor(Date.now() / 1000) - 60 }, secret, {
      algorithm: "HS256"
    }),
  "a token signed with HS512": () => jwt.sign({ sub: "user-1" }, secret, { algorithm: "HS512" })
};

describe("JWT verification", () => {
  for (const [name, makeToken] of Object.entries(badTokens)) {
    it(`rejects ${name} on /api/auth/me`, async () => {
      const response = await request(createTestApp())
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${makeToken()}`);

      assert.equal(response.status, 401);
    });

    it(`rejects ${name} on a list route`, async () => {
      const response = await request(createTestApp())
        .get("/api/lists")
        .set("Authorization", `Bearer ${makeToken()}`);

      assert.equal(response.status, 401);
    });

    it(`rejects ${name} on the event stream`, async () => {
      const response = await request(createTestApp()).get(
        `/api/events?token=${encodeURIComponent(makeToken())}`
      );

      assert.equal(response.status, 401);
    });
  }

  it("signs new tokens with HS256", async () => {
    const signOptions = [];
    const jwtLib = {
      sign(payload, signingSecret, options) {
        signOptions.push(options);
        return jwt.sign(payload, signingSecret, options);
      },
      verify: jwt.verify
    };
    const pool = {
      async query() {
        return { rows: [{ id: "user-1", email: "a@example.com", display_name: "A" }] };
      }
    };
    const response = await request(
      createApp({
        pool,
        jwtLib,
        config: { jwtSecret: secret, jwtExpiresIn: "7d", enableTestRoutes: true }
      })
    )
      .post("/api/test/create-verified-user")
      .send({ email: "a@example.com", password: "password123", display_name: "A" });

    assert.equal(response.status, 201);
    assert.deepEqual(signOptions.map((options) => options.algorithm), ["HS256"]);
    assert.equal(jwt.decode(response.body.token, { complete: true }).header.alg, "HS256");
  });
});
