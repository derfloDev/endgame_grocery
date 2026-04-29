import { describe, it } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import request from "supertest";
import { createApp } from "./app.js";

describe("createApp logging", () => {
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
