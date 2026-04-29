import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { afterEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createApp } from "../app.js";

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
    assert.deepEqual(response.body, { error: "Authentication token is required." });
  });

  it("returns 401 for an invalid token", async () => {
    const response = await request(createTestApp()).get("/api/events?token=bad-token");

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Authentication token is invalid." });
  });

  it("opens an SSE stream with the expected headers and heartbeat", async () => {
    const token = jwt.sign({ sub: "user-1" }, "test-secret");
    const app = createTestApp({ sseHeartbeatIntervalMs: 10 });
    const { req, res } = await openEventStream(app, `/api/events?token=${token}`);
    const chunks = [];

    res.setEncoding("utf8");
    res.on("data", (chunk) => {
      chunks.push(chunk);
    });

    await waitFor(() => chunks.includes(":heartbeat\n\n"));

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["content-type"], "text/event-stream; charset=utf-8");
    assert.equal(res.headers["cache-control"], "no-cache");
    assert.equal(res.headers.connection, "keep-alive");
    assert.equal(res.headers["x-accel-buffering"], "no");

    req.destroy();
  });

  it("removes the connection when the client closes the request", async () => {
    const token = jwt.sign({ sub: "user-1" }, "test-secret");
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
    const app = createTestApp({ sseManager });
    const { req, res } = await openEventStream(app, `/api/events?token=${token}`);

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
