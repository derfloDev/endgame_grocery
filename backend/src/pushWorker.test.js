import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { enqueuePushJob, processPendingPushJobs, startPushWorker } from "./workers/pushWorker.js";

describe("push worker", () => {
  it("enqueues a push job with a single atomic upsert and a JSON array", async () => {
    const queries = [];
    const loggerEntries = [];
    const pool = {
      async query(text, params) {
        queries.push([normalizeSql(text), params]);
        return { rows: [{ item_count: 1 }] };
      }
    };

    await enqueuePushJob({
      pool,
      listId: "list-1",
      actorUserId: "user-1",
      entryText: "Milk",
      logger: createLoggerSpy(loggerEntries),
      now: new Date("2026-04-28T10:00:00Z")
    });

    assert.equal(queries.length, 1);
    assert.match(queries[0][0], /INSERT INTO pending_push_jobs/);
    assert.match(queries[0][0], /\$4::jsonb/);
    assert.match(queries[0][0], /ON CONFLICT \(list_id, actor_user_id\) DO UPDATE/);
    assert.deepEqual(queries[0][1], [
      "list-1",
      "user-1",
      new Date("2026-04-28T10:05:00.000Z"),
      '["Milk"]',
      new Date("2026-04-28T10:00:00.000Z")
    ]);
    assert.deepEqual(loggerEntries, [
      {
        level: "info",
        message: "Push job enqueued",
        fields: {
          listId: "list-1",
          actorUserId: "user-1",
          fireAt: new Date("2026-04-28T10:05:00.000Z"),
          itemCount: 1
        }
      }
    ]);
  });

  it("logs and returns early when VAPID configuration is incomplete", async () => {
    const loggerEntries = [];
    let queryCalled = false;
    let vapidConfigured = false;

    await processPendingPushJobs({
      pool: {
        async query() {
          queryCalled = true;
          return { rows: [] };
        }
      },
      config: {
        vapidPublicKey: "",
        vapidPrivateKey: "private-key",
        vapidContact: ""
      },
      logger: createLoggerSpy(loggerEntries),
      webpushLib: {
        setVapidDetails() {
          vapidConfigured = true;
        },
        async sendNotification() {}
      }
    });

    assert.equal(queryCalled, false);
    assert.equal(vapidConfigured, false);
    assert.deepEqual(loggerEntries, [
      {
        level: "warn",
        message: "Push worker skipped because VAPID configuration is incomplete",
        fields: {
          missingConfig: ["vapidPublicKey", "vapidContact"]
        }
      }
    ]);
  });

  it("batches multiple queued items into one notification and excludes the actor", async () => {
    const sentNotifications = [];
    const deletedEndpoints = [];
    const loggerEntries = [];
    const queries = [];
    const pool = {
      async query(text, params) {
        queries.push([normalizeSql(text), params]);

        if (text.includes("FROM pending_push_jobs")) {
          return {
            rows: [
              {
                id: "job-1",
                list_id: "list-1",
                actor_user_id: "user-1",
                items: ["Milk", "Bread", "Cheese"]
              }
            ]
          };
        }

        if (text.includes("FROM push_cooldowns")) {
          return { rows: [] };
        }

        if (text.includes("FROM lists l")) {
          return {
            rows: [
              {
                list_name: "Weekly groceries",
                actor_name: "Demo User",
                user_id: "user-2"
              }
            ]
          };
        }

        if (text.includes("FROM push_subscriptions")) {
          return {
            rows: [
              {
                id: "sub-1",
                endpoint: "https://push.example.com/subscriptions/1",
                p256dh: "p256dh-key",
                auth: "auth-key"
              }
            ]
          };
        }

        if (text.includes("DELETE FROM push_subscriptions")) {
          deletedEndpoints.push(params[0]);
          return { rows: [] };
        }

        return { rows: [] };
      }
    };

    await processPendingPushJobs({
      pool,
      config: {
        vapidPublicKey: "public-key",
        vapidPrivateKey: "private-key",
        vapidContact: "mailto:test@example.com"
      },
      logger: createLoggerSpy(loggerEntries),
      webpushLib: {
        setVapidDetails() {},
        async sendNotification(subscription, payload) {
          sentNotifications.push({
            subscription,
            payload: JSON.parse(payload)
          });
        }
      },
      now: () => new Date("2026-04-28T10:00:00Z")
    });

    assert.equal(sentNotifications.length, 1);
    assert.deepEqual(sentNotifications[0].subscription, {
      endpoint: "https://push.example.com/subscriptions/1",
      keys: {
        p256dh: "p256dh-key",
        auth: "auth-key"
      }
    });
    assert.equal(sentNotifications[0].payload.title, "Weekly groceries");
    assert.equal(sentNotifications[0].payload.body, "Milk and 2 more items");
    assert.equal(sentNotifications[0].payload.listId, "list-1");
    assert.deepEqual(deletedEndpoints, []);
    assert.ok(queries.some(([sql]) => /recipient\.user_id\s+<>\s+\$2/.test(sql)));
    assert.ok(queries.some(([sql]) => /DELETE FROM pending_push_jobs/.test(sql)));
    assert.ok(queries.some(([sql]) => /INSERT INTO push_cooldowns/.test(sql)));
    assert.deepEqual(loggerEntries, [
      {
        level: "debug",
        message: "Push worker tick loaded due jobs",
        fields: {
          dueJobCount: 1
        }
      },
      {
        level: "info",
        message: "Push job fired",
        fields: {
          jobId: "job-1",
          listId: "list-1"
        }
      },
      {
        level: "info",
        message: "Push recipients found",
        fields: {
          jobId: "job-1",
          listId: "list-1",
          recipientCount: 1
        }
      },
      {
        level: "info",
        message: "Push subscriptions targeted",
        fields: {
          jobId: "job-1",
          listId: "list-1",
          subscriptionCount: 1
        }
      },
      {
        level: "info",
        message: "Push notifications sent",
        fields: {
          jobId: "job-1",
          listId: "list-1",
          notificationsSent: 1,
          subscriptionsExpired: 0
        }
      },
      {
        level: "info",
        message: "Push job processed",
        fields: {
          jobId: "job-1",
          listId: "list-1",
          notificationsSent: 1,
          subscriptionsExpired: 0
        }
      }
    ]);
  });

  it("suppresses queued notifications while the cooldown is active", async () => {
    let sendCalled = false;
    let jobDeleteCount = 0;
    const loggerEntries = [];
    const pool = {
      async query(text) {
        if (text.includes("SKIP LOCKED")) {
          return {
            rows: [
              {
                id: "job-2",
                list_id: "list-1",
                actor_user_id: "user-1",
                items: ["Eggs"]
              }
            ]
          };
        }

        if (text.includes("FROM push_cooldowns")) {
          return {
            rows: [{ last_sent_at: "2026-04-28T09:50:00Z" }]
          };
        }

        if (text.includes("DELETE FROM pending_push_jobs")) {
          jobDeleteCount += 1;
        }

        return { rows: [] };
      }
    };

    await processPendingPushJobs({
      pool,
      config: {
        vapidPublicKey: "public-key",
        vapidPrivateKey: "private-key",
        vapidContact: "mailto:test@example.com"
      },
      logger: createLoggerSpy(loggerEntries),
      webpushLib: {
        setVapidDetails() {},
        async sendNotification() {
          sendCalled = true;
        }
      },
      now: () => new Date("2026-04-28T10:00:00Z")
    });

    assert.equal(sendCalled, false);
    // The claim statement already deleted the job atomically; no separate delete follows.
    assert.equal(jobDeleteCount, 0);
    assert.deepEqual(loggerEntries, [
      {
        level: "debug",
        message: "Push worker tick loaded due jobs",
        fields: {
          dueJobCount: 1
        }
      },
      {
        level: "info",
        message: "Push job fired",
        fields: {
          jobId: "job-2",
          listId: "list-1"
        }
      },
      {
        level: "debug",
        message: "Push job skipped because cooldown is active",
        fields: {
          jobId: "job-2",
          listId: "list-1"
        }
      }
    ]);
  });

  it("logs and deletes jobs when no recipients are available", async () => {
    const loggerEntries = [];
    let jobDeleteCount = 0;
    const pool = {
      async query(text) {
        if (text.includes("SKIP LOCKED")) {
          return {
            rows: [
              {
                id: "job-no-recipients",
                list_id: "list-1",
                actor_user_id: "user-1",
                items: ["Eggs"]
              }
            ]
          };
        }

        if (text.includes("FROM push_cooldowns")) {
          return { rows: [] };
        }

        if (text.includes("FROM lists l")) {
          return { rows: [] };
        }

        if (text.includes("DELETE FROM pending_push_jobs")) {
          jobDeleteCount += 1;
        }

        return { rows: [] };
      }
    };

    await processPendingPushJobs({
      pool,
      config: {
        vapidPublicKey: "public-key",
        vapidPrivateKey: "private-key",
        vapidContact: "mailto:test@example.com"
      },
      logger: createLoggerSpy(loggerEntries),
      webpushLib: {
        setVapidDetails() {},
        async sendNotification() {
          throw new Error("No notification should be sent");
        }
      },
      now: () => new Date("2026-04-28T10:00:00Z")
    });

    // The claim statement already deleted the job atomically; no separate delete follows.
    assert.equal(jobDeleteCount, 0);
    assert.deepEqual(loggerEntries, [
      {
        level: "debug",
        message: "Push worker tick loaded due jobs",
        fields: {
          dueJobCount: 1
        }
      },
      {
        level: "info",
        message: "Push job fired",
        fields: {
          jobId: "job-no-recipients",
          listId: "list-1"
        }
      },
      {
        level: "info",
        message: "Push job skipped because no recipients are available",
        fields: {
          jobId: "job-no-recipients",
          listId: "list-1"
        }
      }
    ]);
  });

  it("logs when recipients have no push subscriptions", async () => {
    const loggerEntries = [];
    let sendCalled = false;
    const pool = {
      async query(text) {
        if (text.includes("SKIP LOCKED")) {
          return {
            rows: [
              {
                id: "job-no-subscriptions",
                list_id: "list-1",
                actor_user_id: "user-1",
                items: ["Eggs"]
              }
            ]
          };
        }

        if (text.includes("FROM push_cooldowns")) {
          return { rows: [] };
        }

        if (text.includes("FROM lists l")) {
          return {
            rows: [
              {
                list_name: "Weekly groceries",
                actor_name: "Demo User",
                user_id: "user-2"
              }
            ]
          };
        }

        if (text.includes("FROM push_subscriptions")) {
          return { rows: [] };
        }

        return { rows: [] };
      }
    };

    await processPendingPushJobs({
      pool,
      config: {
        vapidPublicKey: "public-key",
        vapidPrivateKey: "private-key",
        vapidContact: "mailto:test@example.com"
      },
      logger: createLoggerSpy(loggerEntries),
      webpushLib: {
        setVapidDetails() {},
        async sendNotification() {
          sendCalled = true;
        }
      },
      now: () => new Date("2026-04-28T10:00:00Z")
    });

    assert.equal(sendCalled, false);
    assert.deepEqual(loggerEntries, [
      {
        level: "debug",
        message: "Push worker tick loaded due jobs",
        fields: {
          dueJobCount: 1
        }
      },
      {
        level: "info",
        message: "Push job fired",
        fields: {
          jobId: "job-no-subscriptions",
          listId: "list-1"
        }
      },
      {
        level: "info",
        message: "Push recipients found",
        fields: {
          jobId: "job-no-subscriptions",
          listId: "list-1",
          recipientCount: 1
        }
      },
      {
        level: "info",
        message: "Push job has no subscriptions to notify",
        fields: {
          jobId: "job-no-subscriptions",
          listId: "list-1",
          recipientCount: 1
        }
      },
      {
        level: "info",
        message: "Push notifications sent",
        fields: {
          jobId: "job-no-subscriptions",
          listId: "list-1",
          notificationsSent: 0,
          subscriptionsExpired: 0
        }
      },
      {
        level: "info",
        message: "Push job processed",
        fields: {
          jobId: "job-no-subscriptions",
          listId: "list-1",
          notificationsSent: 0,
          subscriptionsExpired: 0
        }
      }
    ]);
  });

  it("logs startup and expired subscriptions", async () => {
    const loggerEntries = [];
    const queries = [];
    const stopWorker = startPushWorker({
      pool: null,
      config: {},
      intervalMs: 60000,
      logger: createLoggerSpy(loggerEntries)
    });

    stopWorker();

    const pool = {
      async query(text, params) {
        queries.push([normalizeSql(text), params]);

        if (text.includes("FROM pending_push_jobs")) {
          return {
            rows: [
              {
                id: "job-3",
                list_id: "list-2",
                actor_user_id: "user-1",
                items: ["Apples"]
              }
            ]
          };
        }

        if (text.includes("FROM push_cooldowns")) {
          return { rows: [] };
        }

        if (text.includes("FROM lists l")) {
          return {
            rows: [
              {
                list_name: "Office",
                actor_name: "Demo User",
                user_id: "user-2"
              }
            ]
          };
        }

        if (text.includes("FROM push_subscriptions")) {
          return {
            rows: [
              {
                id: "sub-1",
                endpoint: "https://push.example.com/subscriptions/1234567890abcdefghijklmnopqrstuvwxyz",
                p256dh: "p256dh-key",
                auth: "auth-key"
              }
            ]
          };
        }

        return { rows: [] };
      }
    };

    await processPendingPushJobs({
      pool,
      config: {
        vapidPublicKey: "public-key",
        vapidPrivateKey: "private-key",
        vapidContact: "mailto:test@example.com"
      },
      logger: createLoggerSpy(loggerEntries),
      webpushLib: {
        setVapidDetails() {},
        async sendNotification() {
          const error = new Error("Gone");
          error.statusCode = 410;
          throw error;
        }
      },
      now: () => new Date("2026-04-28T10:00:00Z")
    });

    assert.ok(queries.some(([sql]) => /DELETE FROM push_subscriptions/.test(sql)));
    assert.deepEqual(loggerEntries, [
      {
        level: "info",
        message: "Push worker started",
        fields: {
          intervalMs: 60000
        }
      },
      {
        level: "debug",
        message: "Push worker tick loaded due jobs",
        fields: {
          dueJobCount: 1
        }
      },
      {
        level: "info",
        message: "Push job fired",
        fields: {
          jobId: "job-3",
          listId: "list-2"
        }
      },
      {
        level: "info",
        message: "Push recipients found",
        fields: {
          jobId: "job-3",
          listId: "list-2",
          recipientCount: 1
        }
      },
      {
        level: "info",
        message: "Push subscriptions targeted",
        fields: {
          jobId: "job-3",
          listId: "list-2",
          subscriptionCount: 1
        }
      },
      {
        level: "info",
        message: "Push subscription expired",
        fields: {
          endpoint: "https://push.example.com/subscriptions/1234567890abcdefghijk"
        }
      },
      {
        level: "info",
        message: "Push notifications sent",
        fields: {
          jobId: "job-3",
          listId: "list-2",
          notificationsSent: 0,
          subscriptionsExpired: 1
        }
      },
      {
        level: "info",
        message: "Push job processed",
        fields: {
          jobId: "job-3",
          listId: "list-2",
          notificationsSent: 0,
          subscriptionsExpired: 1
        }
      }
    ]);
  });

  it("reports the merged item count returned by the upsert", async () => {
    const loggerEntries = [];

    await enqueuePushJob({
      pool: {
        async query() {
          return { rows: [{ item_count: 3 }] };
        }
      },
      listId: "list-1",
      actorUserId: "user-1",
      entryText: "Bread",
      logger: createLoggerSpy(loggerEntries),
      now: new Date("2026-04-28T10:00:00Z")
    });

    assert.equal(loggerEntries[0].fields.itemCount, 3);
  });

  describe("per-subscription error handling", () => {
    function createDeliveryPool({ subscriptions, queries }) {
      return {
        async query(text, params) {
          queries.push([normalizeSql(text), params]);

          if (text.includes("SKIP LOCKED")) {
            return {
              rows: [{ id: "job-1", list_id: "list-1", actor_user_id: "user-1", items: ["Milk"] }]
            };
          }

          if (text.includes("FROM push_cooldowns")) {
            return { rows: [] };
          }

          if (text.includes("FROM lists l")) {
            return { rows: [{ list_name: "Home", actor_name: "Demo", user_id: "user-2" }] };
          }

          if (text.includes("FROM push_subscriptions")) {
            return { rows: subscriptions };
          }

          return { rows: [] };
        }
      };
    }

    const config = {
      vapidPublicKey: "public-key",
      vapidPrivateKey: "private-key",
      vapidContact: "mailto:test@example.com"
    };

    function subscription(id) {
      return {
        id: `sub-${id}`,
        endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
        p256dh: "p",
        auth: "a"
      };
    }

    it("deletes subscriptions that answer 404 as well as 410", async () => {
      const queries = [];
      const statusByEndpoint = new Map([
        ["https://fcm.googleapis.com/fcm/send/a", 404],
        ["https://fcm.googleapis.com/fcm/send/b", 410]
      ]);

      await processPendingPushJobs({
        pool: createDeliveryPool({ subscriptions: [subscription("a"), subscription("b")], queries }),
        config,
        logger: createLoggerSpy([]),
        webpushLib: {
          setVapidDetails() {},
          async sendNotification({ endpoint }) {
            const error = new Error("gone");
            error.statusCode = statusByEndpoint.get(endpoint);
            throw error;
          }
        },
        now: () => new Date("2026-04-28T10:00:00Z")
      });

      const deleted = queries
        .filter(([sql]) => /DELETE FROM push_subscriptions/.test(sql))
        .map(([, params]) => params[0]);
      assert.deepEqual(deleted, [
        "https://fcm.googleapis.com/fcm/send/a",
        "https://fcm.googleapis.com/fcm/send/b"
      ]);
    });

    it("keeps delivering after one subscription fails and still records the cooldown", async () => {
      const queries = [];
      const loggerEntries = [];
      const delivered = [];

      await processPendingPushJobs({
        pool: createDeliveryPool({
          subscriptions: [subscription("a"), subscription("b"), subscription("c")],
          queries
        }),
        config,
        logger: createLoggerSpy(loggerEntries),
        webpushLib: {
          setVapidDetails() {},
          async sendNotification({ endpoint }) {
            if (endpoint.endsWith("/b")) {
              const error = new Error("push service unavailable");
              error.statusCode = 500;
              throw error;
            }

            delivered.push(endpoint);
          }
        },
        now: () => new Date("2026-04-28T10:00:00Z")
      });

      assert.deepEqual(delivered, [
        "https://fcm.googleapis.com/fcm/send/a",
        "https://fcm.googleapis.com/fcm/send/c"
      ]);
      assert.ok(queries.some(([sql]) => /INSERT INTO push_cooldowns/.test(sql)));
      assert.ok(!queries.some(([sql]) => /DELETE FROM push_subscriptions/.test(sql)));
      const failure = loggerEntries.find((entry) => entry.message === "Push notification failed");
      assert.equal(failure.level, "warn");
      assert.equal(failure.fields.statusCode, 500);
      assert.equal(
        loggerEntries.find((entry) => entry.message === "Push notifications sent").fields.notificationsSent,
        2
      );
    });
  });

  describe("tick scheduling", () => {
    afterEach(() => {
      mock.timers.reset();
    });

    it("never starts a tick while the previous one is still running", async () => {
      mock.timers.enable({ apis: ["setTimeout"] });
      let claimQueries = 0;
      let releaseClaim;
      const claimGate = new Promise((resolve) => {
        releaseClaim = resolve;
      });
      const stop = startPushWorker({
        pool: {
          async query(text) {
            if (text.includes("SKIP LOCKED")) {
              claimQueries += 1;
              await claimGate;
            }

            return { rows: [] };
          }
        },
        config: {
          vapidPublicKey: "public-key",
          vapidPrivateKey: "private-key",
          vapidContact: "mailto:test@example.com"
        },
        webpushLib: { setVapidDetails() {}, async sendNotification() {} },
        intervalMs: 5000,
        logger: createLoggerSpy([])
      });

      mock.timers.tick(5000);
      await flushMicrotasks();
      assert.equal(claimQueries, 1);

      // The first tick is still blocked, so further time passing must not start another one.
      mock.timers.tick(20000);
      await flushMicrotasks();
      assert.equal(claimQueries, 1);

      releaseClaim();
      await flushMicrotasks();
      mock.timers.tick(5000);
      await flushMicrotasks();
      assert.equal(claimQueries, 2);

      stop();
    });

    it("keeps ticking after a failed tick and stop() cancels the pending timer", async () => {
      mock.timers.enable({ apis: ["setTimeout"] });
      const loggerEntries = [];
      let claimQueries = 0;
      const stop = startPushWorker({
        pool: {
          async query() {
            claimQueries += 1;
            throw new Error("database down");
          }
        },
        config: {
          vapidPublicKey: "public-key",
          vapidPrivateKey: "private-key",
          vapidContact: "mailto:test@example.com"
        },
        webpushLib: { setVapidDetails() {}, async sendNotification() {} },
        intervalMs: 1000,
        logger: createLoggerSpy(loggerEntries)
      });

      mock.timers.tick(1000);
      await flushMicrotasks();
      mock.timers.tick(1000);
      await flushMicrotasks();
      assert.equal(claimQueries, 2);
      assert.equal(
        loggerEntries.filter((entry) => entry.message === "Push worker tick failed").length,
        2
      );

      stop();
      mock.timers.tick(10000);
      await flushMicrotasks();
      assert.equal(claimQueries, 2);
    });
  });
});

async function flushMicrotasks() {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}

function createLoggerSpy(entries) {
  return {
    info(fields, message) {
      entries.push({ level: "info", message, fields: fields ?? {} });
    },
    debug(fields, message) {
      entries.push({ level: "debug", message, fields: fields ?? {} });
    },
    error(fields, message) {
      entries.push({ level: "error", message, fields: fields ?? {} });
    },
    warn(fields, message) {
      entries.push({ level: "warn", message, fields: fields ?? {} });
    }
  };
}
