import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { afterEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../app.js";
import { createSseTickets } from "../sseTickets.js";

const servers = new Set();

afterEach(async () => {
  await Promise.all(
    Array.from(servers, (server) =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      })
    )
  );
  servers.clear();
});

describe("events route", () => {
  it("returns 401 without a token", async () => {
    const response = await request(createTestApp()).get("/api/events");

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Authentication token is required.", code: "auth.token_required" });
  });

  it("returns 401 for an invalid bearer token", async () => {
    const response = await request(createTestApp())
      .get("/api/events")
      .set("Authorization", "Bearer bad-token");

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Authentication token is invalid.", code: "auth.invalid_token" });
  });

  it("no longer accepts the JWT in the query string", async () => {
    const token = jwt.sign({ sub: "user-1" }, "test-secret", { algorithm: "HS256" });
    const response = await request(createTestApp()).get(`/api/events?token=${token}`);

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Authentication token is required.", code: "auth.token_required" });
  });

  it("returns 401 for an unknown ticket", async () => {
    const response = await request(createTestApp()).get("/api/events?ticket=unknown");

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Authentication ticket is invalid.", code: "auth.invalid_ticket" });
  });

  describe("POST /api/events/ticket", () => {
    it("requires a valid bearer token", async () => {
      const missing = await request(createTestApp()).post("/api/events/ticket");
      const invalid = await request(createTestApp())
        .post("/api/events/ticket")
        .set("Authorization", "Bearer bad-token");

      assert.equal(missing.status, 401);
      assert.equal(invalid.status, 401);
    });

    it("issues a ticket that opens the stream exactly once", async () => {
      const token = jwt.sign({ sub: "user-1" }, "test-secret", { algorithm: "HS256" });
      const app = createTestApp();
      const issued = await request(app)
        .post("/api/events/ticket")
        .set("Authorization", `Bearer ${token}`);

      assert.equal(issued.status, 200);
      assert.equal(issued.headers["cache-control"], "no-store");
      assert.match(issued.body.ticket, /^[A-Za-z0-9_-]{43}$/);

      const { req } = await openEventStream(app, `/api/events?ticket=${issued.body.ticket}`);
      req.destroy();

      const reused = await request(app).get(`/api/events?ticket=${issued.body.ticket}`);
      assert.equal(reused.status, 401);
    });

    it("rejects a ticket after it expired", async () => {
      let now = 0;
      const sseTickets = createSseTickets({ now: () => now });
      const ticket = sseTickets.issue("user-1");
      now += 30_001;

      const response = await request(createTestApp({ sseTickets })).get(`/api/events?ticket=${ticket}`);

      assert.equal(response.status, 401);
    });
  });

  it("opens an SSE stream with the expected headers and named ping heartbeat", async () => {
    const sseTickets = createSseTickets();
    const ticket = sseTickets.issue("user-1");
    const app = createTestApp({ sseHeartbeatIntervalMs: 10, sseTickets });
    const { req, res } = await openEventStream(app, `/api/events?ticket=${ticket}`);
    const chunks = [];

    res.setEncoding("utf8");
    res.on("data", (chunk) => {
      chunks.push(chunk);
    });

    try {
      await waitFor(() => chunks.join("").split("\n\n").slice(0, -1).length >= 2);
      const frames = chunks.join("").split("\n\n").slice(0, -1);
      for (const frame of frames) {
        assert.match(frame, /^event: ping\ndata: \{"ts":"[^"]+"\}$/);
        const payload = JSON.parse(frame.split("\ndata: ")[1]);
        assert.equal(new Date(payload.ts).toISOString(), payload.ts);
      }
      // Named ping frames cannot dispatch the default message event used by older clients.
      assert.ok(frames.every((frame) => frame.startsWith("event: ping\n")));

      assert.equal(res.statusCode, 200);
      assert.equal(res.headers["content-type"], "text/event-stream; charset=utf-8");
      assert.equal(res.headers["cache-control"], "no-cache");
      assert.equal(res.headers.connection, "keep-alive");
      assert.equal(res.headers["x-accel-buffering"], "no");
    } finally {
      req.destroy();
    }
  });

  it("removes the connection when the client closes the request", async () => {
    const sseTickets = createSseTickets();
    const ticket = sseTickets.issue("user-1");
    const sseManager = {
      addCalls: [],
      removeCalls: [],
      add(userId, res) {
        this.addCalls.push({ userId, res });
      },
      remove(userId, res) {
        this.removeCalls.push({ userId, res });
      }
    };
    const app = createTestApp({ sseManager, sseTickets });
    const { req, res } = await openEventStream(app, `/api/events?ticket=${ticket}`);

    req.destroy();
    await waitFor(() => sseManager.removeCalls.length === 1);

    assert.equal(sseManager.addCalls.length, 1);
    assert.equal(sseManager.addCalls[0].userId, "user-1");
    assert.equal(sseManager.removeCalls.length, 1);
    assert.equal(sseManager.removeCalls[0].userId, "user-1");
    assert.equal(sseManager.removeCalls[0].res, sseManager.addCalls[0].res);
    assert.notEqual(sseManager.addCalls[0].res, res);
  });
});

function createTestApp(options = {}) {
  return createApp({
    pool: null,
    startWorkers: false,
    config: {
      jwtSecret: "test-secret",
      jwtExpiresIn: "7d"
    },
    ...options
  });
}

async function openEventStream(app, path) {
  const server = app.listen(0);
  servers.add(server);
  await once(server, "listening");

  return await new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.get(
      {
        host: "127.0.0.1",
        port: address.port,
        path
      },
      (res) => {
        resolve({ req, res });
      }
    );

    req.on("error", reject);
  });
}

async function waitFor(predicate, timeoutMs = 1000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  assert.fail("Timed out waiting for condition.");
}
