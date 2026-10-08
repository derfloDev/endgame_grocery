import { describe, it } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import request from "supertest";
import { createApp } from "./app.js";

function createAuthedApp(pool, options = {}) {
  return createApp({
    pool,
    config: {
      vapidPublicKey: "test-public-key",
      ...options.config
    },
    startWorkers: false,
    logger: options.logger,
    requireAuthMiddleware(req, _res, next) {
      req.user = { sub: "user-1" };
      next();
    }
  });
}

describe("push routes", () => {
  it("returns the configured VAPID public key", async () => {
    const response = await request(createApp({
      config: { vapidPublicKey: "test-public-key" },
      startWorkers: false
    })).get("/api/push/vapid-public-key");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { publicKey: "test-public-key" });
  });

  it("stores a push subscription for the authenticated user", async () => {
    const { logger, getEntries } = createLogCapture();
    let insertParams = null;
    const pool = {
      async query(text, params) {
        insertParams = params;
        assert.match(text, /INSERT INTO push_subscriptions/);
        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool, { logger })).post("/api/push/subscribe").send({
      endpoint: "https://fcm.googleapis.com/fcm/send/1",
      keys: {
        p256dh: "p256dh-key",
        auth: "auth-key"
      }
    });

    assert.equal(response.status, 201);
    assert.deepEqual(response.body, { message: "Push subscription saved." });
    assert.deepEqual(insertParams, [
      "user-1",
      "https://fcm.googleapis.com/fcm/send/1",
      "p256dh-key",
      "auth-key"
    ]);

    const subscriptionLog = getEntries().find((entry) => entry.msg === "Push subscription saved");

    assert.equal(subscriptionLog.userId, "user-1");
    assert.equal(subscriptionLog.endpoint, "https://fcm.googleapis.com/fcm/send/1");
  });

  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "https://web.push.apple.com/abc",
    "https://push.apple.com/abc"
  ]) {
    it(`accepts the push service endpoint ${endpoint}`, async () => {
      const pool = { async query() { return { rows: [] }; } };

      const response = await request(createAuthedApp(pool)).post("/api/push/subscribe").send({
        endpoint,
        keys: { p256dh: "p256dh-key", auth: "auth-key" }
      });

      assert.equal(response.status, 201);
    });
  }

  for (const endpoint of [
    "https://10.0.0.1/x",
    "https://[::1]/x",
    "http://fcm.googleapis.com/x",
    "https://push.example.com/subscriptions/1",
    "https://evilfcm.googleapis.com/x",
    "https://fcm.googleapis.com.evil.test/x",
    "https://user:pass@fcm.googleapis.com/x",
    "ftp://fcm.googleapis.com/x",
    "not a url"
  ]) {
    it(`rejects the endpoint ${endpoint} with 400 and stores nothing`, async () => {
      let queried = false;
      const pool = {
        async query() {
          queried = true;
          return { rows: [] };
        }
      };

      const response = await request(createAuthedApp(pool)).post("/api/push/subscribe").send({
        endpoint,
        keys: { p256dh: "p256dh-key", auth: "auth-key" }
      });

      assert.equal(response.status, 400);
      assert.match(response.body.error, /push service/i);
      assert.equal(queried, false);
    });
  }

  it("removes a stored push subscription", async () => {
    const { logger, getEntries } = createLogCapture();
    let deleteParams = null;
    const pool = {
      async query(text, params) {
        deleteParams = params;
        assert.match(text, /DELETE FROM push_subscriptions/);
        return { rows: [] };
      }
    };

    const response = await request(createAuthedApp(pool, { logger }))
      .delete("/api/push/subscribe")
      .send({ endpoint: "https://push.example.com/subscriptions/1" });

    assert.equal(response.status, 204);
    assert.deepEqual(deleteParams, ["user-1", "https://push.example.com/subscriptions/1"]);

    const subscriptionLog = getEntries().find((entry) => entry.msg === "Push subscription removed");

    assert.equal(subscriptionLog.userId, "user-1");
    assert.equal(subscriptionLog.endpoint, "https://push.example.com/subscriptions/1");
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
