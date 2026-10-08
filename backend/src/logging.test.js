import { describe, it } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "./app.js";
import { createLogger, sanitizeRequestUrl } from "./logger.js";

const secret = "log-test-secret-0123456789abcdef0123456789abcdef";

function createCapturedApp() {
  const lines = [];
  const logger = createLogger({ level: "trace", base: null }, {
    write(chunk) {
      lines.push(chunk);
    }
  });
  const app = createApp({
    pool: { async query() { return { rows: [] }; } },
    startWorkers: false,
    logger,
    config: { jwtSecret: secret, jwtExpiresIn: "7d" }
  });

  return { app, output: () => lines.join("") };
}

describe("request logging", () => {
  it("never logs the Authorization header, X-Api-Key or query tokens", async () => {
    const { app, output } = createCapturedApp();
    const jwtValue = jwt.sign({ sub: "user-1" }, secret, { algorithm: "HS256" });
    const apiKey = "11111111-2222-4333-8444-555555555555";

    await request(app)
      .get("/api/lists?token=query-secret-value&ticket=ticket-secret-value")
      .set("Authorization", `Bearer ${jwtValue}`)
      .set("X-Api-Key", apiKey)
      .set("Cookie", "session=cookie-secret-value");
    await request(app).get(`/api/v1/lists?token=${jwtValue}`).set("X-Api-Key", apiKey);

    const logged = output();
    assert.ok(logged.length > 0, "expected request log lines");
    for (const secretValue of [jwtValue, apiKey, "query-secret-value", "ticket-secret-value", "cookie-secret-value"]) {
      assert.equal(logged.includes(secretValue), false, `log output leaked ${secretValue}`);
    }
  });

  it("logs the method, path and remote address of a request", async () => {
    const { app, output } = createCapturedApp();

    await request(app).get("/api/config?x=1");

    const entry = output().trim().split("\n").map((line) => JSON.parse(line)).find((line) => line.req);
    assert.equal(entry.req.method, "GET");
    assert.equal(entry.req.url, "/api/config");
    assert.ok(entry.req.remoteAddress);
    assert.equal(entry.req.headers, undefined);
  });

  it("does not log the invite token in the path", async () => {
    const { app, output } = createCapturedApp();
    const inviteToken = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

    await request(app).get(`/api/invites/${inviteToken}`);

    assert.equal(output().includes(inviteToken), false);
    assert.match(output(), /\/api\/invites\/:token/);
  });

  it("redacts credential headers if a log call includes request headers", () => {
    const lines = [];
    const logger = createLogger({ level: "info", base: null }, { write: (chunk) => lines.push(chunk) });

    logger.info({
      req: { headers: { authorization: "Bearer secret", "x-api-key": "key-secret", cookie: "c=secret", accept: "*/*" } }
    });

    const logged = lines.join("");
    assert.equal(/secret/.test(logged), false);
    assert.match(logged, /\[redacted\]/);
    assert.match(logged, /accept/);
  });
});

describe("sanitizeRequestUrl", () => {
  it("strips query strings", () => {
    assert.equal(sanitizeRequestUrl("/api/lists?token=abc"), "/api/lists");
    assert.equal(sanitizeRequestUrl("/api/events?ticket=abc"), "/api/events");
  });

  it("replaces the invite token segment and keeps a trailing action", () => {
    assert.equal(sanitizeRequestUrl("/api/invites/abc-123"), "/api/invites/:token");
    assert.equal(sanitizeRequestUrl("/api/invites/abc-123/accept?x=1"), "/api/invites/:token/accept");
  });

  it("leaves other paths alone and tolerates missing urls", () => {
    assert.equal(sanitizeRequestUrl("/api/lists/1/entries"), "/api/lists/1/entries");
    assert.equal(sanitizeRequestUrl(undefined), "");
  });
});
