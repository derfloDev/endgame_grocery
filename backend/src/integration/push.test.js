import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { enqueuePushJob, processPendingPushJobs } from "../workers/pushWorker.js";
import {
  addMember,
  createList,
  createTestDatabase,
  createUser,
  describeDb
} from "./helpers.js";

const silentLogger = pino({ level: "silent" });
const vapidConfig = {
  vapidPublicKey: "public-key",
  vapidPrivateKey: "private-key",
  vapidContact: "mailto:test@example.com"
};

describeDb("push pipeline (PostgreSQL)", () => {
  let db;
  let actor;
  let recipient;
  let list;

  before(async () => {
    db = await createTestDatabase();
    actor = await createUser(db.pool, { displayName: "Actor" });
    recipient = await createUser(db.pool, { displayName: "Recipient" });
    list = await createList(db.pool, { ownerId: actor.id, name: "Home" });
    await addMember(db.pool, { listId: list.id, userId: recipient.id });
  });

  after(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.pool.query("DELETE FROM pending_push_jobs");
    await db.pool.query("DELETE FROM push_subscriptions");
    await db.pool.query("DELETE FROM push_cooldowns");
  });

  function enqueue(entryText, now) {
    return enqueuePushJob({
      pool: db.pool,
      listId: list.id,
      actorUserId: actor.id,
      entryText,
      logger: silentLogger,
      now
    });
  }

  async function addSubscription(endpoint) {
    await db.pool.query(
      "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, 'p', 'a')",
      [recipient.id, endpoint]
    );
  }

  async function makeJobsDue() {
    await db.pool.query("UPDATE pending_push_jobs SET fire_at = now() - interval '1 minute'");
  }

  function runWorker(webpushLib) {
    return processPendingPushJobs({
      pool: db.pool,
      config: vapidConfig,
      logger: silentLogger,
      webpushLib: { setVapidDetails() {}, ...webpushLib }
    });
  }

  describe("enqueue", () => {
    it("stores one row with a JSON array of the entry text", async () => {
      await enqueue("Milk", new Date());

      const { rows } = await db.pool.query(
        "SELECT items, jsonb_typeof(items) AS type FROM pending_push_jobs"
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].type, "array");
      assert.deepEqual(rows[0].items, ["Milk"]);
    });

    it("merges concurrent enqueues into one row without losing items", async () => {
      const now = new Date();
      const texts = ["Milk", "Bread", "Eggs", "Butter", "Cheese"];

      await Promise.all(texts.map((text) => enqueue(text, now)));

      const { rows } = await db.pool.query("SELECT items FROM pending_push_jobs");
      assert.equal(rows.length, 1);
      assert.deepEqual([...rows[0].items].sort(), [...texts].sort());
    });

    it("starts a new batch once the previous window has elapsed", async () => {
      const first = new Date("2026-04-28T10:00:00Z");
      await enqueue("Milk", first);
      await enqueue("Bread", new Date(first.getTime() + 10 * 60 * 1000));

      const { rows } = await db.pool.query("SELECT items FROM pending_push_jobs");
      assert.equal(rows.length, 1);
      assert.deepEqual(rows[0].items, ["Bread"]);
    });
  });

  describe("worker", () => {
    it("delivers a due job once, removes it and records the cooldown", async () => {
      await addSubscription("https://fcm.googleapis.com/fcm/send/one");
      await enqueue("Milk", new Date());
      await enqueue("Bread", new Date());
      await makeJobsDue();
      const sent = [];

      await runWorker({
        async sendNotification(subscription, payload) {
          sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
        }
      });

      assert.equal(sent.length, 1);
      assert.equal(sent[0].payload.title, "Home");
      assert.equal(sent[0].payload.body, "Milk and 1 more item");
      const jobs = await db.pool.query("SELECT 1 FROM pending_push_jobs");
      assert.equal(jobs.rowCount, 0);
      const cooldowns = await db.pool.query("SELECT 1 FROM push_cooldowns WHERE list_id = $1", [list.id]);
      assert.equal(cooldowns.rowCount, 1);
    });

    it("sends a job exactly once when two workers run at the same time", async () => {
      await addSubscription("https://fcm.googleapis.com/fcm/send/one");
      await enqueue("Milk", new Date());
      await makeJobsDue();
      let sent = 0;
      const webpushLib = {
        async sendNotification() {
          sent += 1;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      };

      await Promise.all([runWorker(webpushLib), runWorker(webpushLib)]);

      assert.equal(sent, 1);
    });

    it("does not lose an item enqueued after the job was claimed", async () => {
      await addSubscription("https://fcm.googleapis.com/fcm/send/one");
      await enqueue("Milk", new Date());
      await makeJobsDue();

      await runWorker({
        async sendNotification() {
          // Arrives while the claimed job is being delivered.
          await enqueue("Late item", new Date());
        }
      });

      const { rows } = await db.pool.query("SELECT items FROM pending_push_jobs");
      assert.equal(rows.length, 1);
      assert.deepEqual(rows[0].items, ["Late item"]);
    });

    it("deletes subscriptions answering 404 or 410 and still completes the job", async () => {
      await addSubscription("https://fcm.googleapis.com/fcm/send/gone-404");
      await addSubscription("https://fcm.googleapis.com/fcm/send/gone-410");
      await addSubscription("https://fcm.googleapis.com/fcm/send/alive");
      await enqueue("Milk", new Date());
      await makeJobsDue();
      const delivered = [];

      await runWorker({
        async sendNotification({ endpoint }) {
          const statusCode = endpoint.endsWith("gone-404") ? 404 : endpoint.endsWith("gone-410") ? 410 : null;

          if (statusCode) {
            const error = new Error("gone");
            error.statusCode = statusCode;
            throw error;
          }

          delivered.push(endpoint);
        }
      });

      assert.deepEqual(delivered, ["https://fcm.googleapis.com/fcm/send/alive"]);
      const subscriptions = await db.pool.query("SELECT endpoint FROM push_subscriptions");
      assert.deepEqual(
        subscriptions.rows.map((row) => row.endpoint),
        ["https://fcm.googleapis.com/fcm/send/alive"]
      );
      const jobs = await db.pool.query("SELECT 1 FROM pending_push_jobs");
      assert.equal(jobs.rowCount, 0);
    });

    it("keeps serving the other subscriptions when one fails with a server error", async () => {
      await addSubscription("https://fcm.googleapis.com/fcm/send/a");
      await addSubscription("https://fcm.googleapis.com/fcm/send/broken");
      await addSubscription("https://fcm.googleapis.com/fcm/send/c");
      await enqueue("Milk", new Date());
      await makeJobsDue();
      const delivered = [];

      await runWorker({
        async sendNotification({ endpoint }) {
          if (endpoint.endsWith("broken")) {
            const error = new Error("push service unavailable");
            error.statusCode = 500;
            throw error;
          }

          delivered.push(endpoint);
        }
      });

      assert.equal(delivered.length, 2);
      const subscriptions = await db.pool.query("SELECT 1 FROM push_subscriptions");
      assert.equal(subscriptions.rowCount, 3);
      const cooldowns = await db.pool.query("SELECT 1 FROM push_cooldowns WHERE list_id = $1", [list.id]);
      assert.equal(cooldowns.rowCount, 1);
    });
  });
});
