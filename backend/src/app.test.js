import { describe, it } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import request from "supertest";
import { createApp } from "./app.js";

describe("createApp logging", () => {
  it("returns the public runtime config with registration enabled by default", async () => {
    const app = createApp({
      pool: null,
      startWorkers: false
    });

    const response = await request(app).get("/api/config");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { registrationEnabled: true });
  });

  it("returns the public runtime config when registration is disabled", async () => {
    const app = createApp({
      config: {
        registrationEnabled: false
      },
      pool: null,
      startWorkers: false
    });

    const response = await request(app).get("/api/config");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { registrationEnabled: false });
  });

  it("logs requests except the health check", async () => {
    const { logger, getEntries } = createLogCapture();
    let queryCount = 0;
    const pool = {
      async query(text) {
        queryCount += 1;

        if (queryCount === 1) {
          assert.match(text, /SELECT l\.id/);
          return { rows: [{ id: "list-1" }] };
        }

        return { rows: [] };
      }
    };
    const app = createApp({
      logger,
      pool,
      requireAuthMiddleware(req, _res, next) {
        req.user = { sub: "user-1" };
        next();
      }
    });

    await request(app).get("/api/health");
    await request(app).get("/api/lists/list-1/entries");

    const requestLogs = getEntries().filter((entry) => entry.msg === "request completed");

    assert.equal(requestLogs.length, 1);
    assert.equal(requestLogs[0].req.method, "GET");
    assert.equal(requestLogs[0].req.url, "/api/lists/list-1/entries");
    assert.equal(requestLogs[0].res.statusCode, 200);
    assert.equal(typeof requestLogs[0].responseTime, "number");
  });

  it("logs unhandled errors through the shared logger", async () => {
    const { logger, getEntries } = createLogCapture();
    const app = createApp({
      logger,
      pool: null,
      requireAuthMiddleware(req, _res, next) {
        req.user = { sub: "user-1" };
        next();
      }
    });

    const response = await request(app).get("/api/lists/list-1/entries");

    assert.equal(response.status, 500);
    assert.deepEqual(response.body, { error: "Internal server error." });

    const errorLog = getEntries().find((entry) => entry.msg === "Unhandled error");

    assert.equal(errorLog.err.message, "Database connection is not configured.");
  });

  it("warns at startup when push VAPID configuration is incomplete", () => {
    const { logger, getEntries } = createLogCapture();

    createApp({
      logger,
      pool: null,
      startWorkers: true,
      config: {
        vapidPublicKey: "",
        vapidPrivateKey: "private-key",
        vapidContact: ""
      }
    });

    const warningLog = getEntries().find(
      (entry) => entry.msg === "Push notifications disabled because VAPID configuration is incomplete"
    );

    assert.deepEqual(warningLog.missingConfig, ["vapidPublicKey", "vapidContact"]);
  });
});

function createLogCapture() {
  const lines = [];
  const logger = pino({ level: "trace", base: null }, {
    write(chunk) {
      lines.push(chunk.trim());
    }
  });

  return {
    logger,
    getEntries() {
      return lines.filter(Boolean).map((line) => JSON.parse(line));
    }
  };
}
