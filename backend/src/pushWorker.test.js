import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { enqueuePushJob, processPendingPushJobs } from "./workers/pushWorker.js";

describe("push worker", () => {
  it("enqueues a new push job when none exists", async () => {
    const queries = [];
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
  });

  it("batches multiple queued items into one notification and excludes the actor", async () => {
    const sentNotifications = [];
    const deletedEndpoints = [];
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
    assert.equal(sentNotifications[0].payload.body, "Milk und 2 weitere Artikel");
    assert.equal(sentNotifications[0].payload.listId, "list-1");
    assert.deepEqual(deletedEndpoints, []);
    assert.ok(queries.some(([sql]) => /recipient\.user_id\s+<>\s+\$2/.test(sql)));
    assert.ok(queries.some(([sql]) => /DELETE FROM pending_push_jobs/.test(sql)));
    assert.ok(queries.some(([sql]) => /INSERT INTO push_cooldowns/.test(sql)));
  });

  it("suppresses queued notifications while the cooldown is active", async () => {
    let sendCalled = false;
    let deletedJobId = null;
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
  });
});

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}
