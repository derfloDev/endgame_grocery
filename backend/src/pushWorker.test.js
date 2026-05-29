import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { enqueuePushJob, processPendingPushJobs, startPushWorker } from "./workers/pushWorker.js";

describe("push worker", () => {
  it("enqueues a new push job when none exists", async () => {
    const queries = [];
    const loggerEntries = [];
    const pool = {
      async query(text, params) {
        queries.push([normalizeSql(text), params]);

        if (text.includes("SELECT id, items, fire_at")) {
          return { rows: [] };
        }

        return { rows: [] };
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

    assert.match(queries[0][0], /SELECT id, items, fire_at/);
    assert.deepEqual(queries[0][1], ["list-1", "user-1"]);
    assert.match(queries[1][0], /INSERT INTO pending_push_jobs/);
    assert.deepEqual(queries[1][1], [
      "list-1",
      "user-1",
      new Date("2026-04-28T10:05:00.000Z"),
      ["Milk"]
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
    let deletedJobId = null;
    const loggerEntries = [];
    const pool = {
      async query(text, params) {
        if (text.includes("SELECT id, list_id, actor_user_id, items")) {
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
          deletedJobId = params[0];
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
    assert.equal(deletedJobId, "job-2");
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
    let deletedJobId = null;
    const pool = {
      async query(text, params) {
        if (text.includes("SELECT id, list_id, actor_user_id, items")) {
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
          deletedJobId = params[0];
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

    assert.equal(deletedJobId, "job-no-recipients");
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
        if (text.includes("SELECT id, list_id, actor_user_id, items")) {
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
});

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
