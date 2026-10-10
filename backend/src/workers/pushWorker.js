import webpush from "web-push";
import { getPool } from "../db/client.js";
import { getConfig } from "../env.js";
import { logger as defaultLogger } from "../logger.js";

/**
 * Queues a push notification for the other members of a list.
 *
 * Entries added by the same actor within the debounce window are merged into one job. The
 * insert-or-merge is a single statement, so concurrent enqueues cannot create duplicate rows or
 * lose items. `items` is a jsonb column, so the entry text is bound as a JSON array string.
 *
 * @param {object} options Enqueue options.
 * @param {import("pg").Pool} options.pool Database pool.
 * @param {string} options.listId List the entry was added to.
 * @param {string} options.actorUserId User who added the entry.
 * @param {string} options.entryText Text of the new entry.
 * @param {typeof defaultLogger} [options.logger] Application logger.
 * @param {Date} [options.now] Current time.
 * @returns {Promise<void>}
 */
export async function enqueuePushJob({
  pool,
  listId,
  actorUserId,
  entryText,
  logger = defaultLogger,
  now = new Date()
}) {
  const fireAt = addMinutes(now, 5);
  const result = await pool.query(
    `
      INSERT INTO pending_push_jobs (list_id, actor_user_id, fire_at, items)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (list_id, actor_user_id) DO UPDATE
      SET items = CASE
            WHEN pending_push_jobs.fire_at > $5 THEN pending_push_jobs.items || EXCLUDED.items
            ELSE EXCLUDED.items
          END,
          fire_at = EXCLUDED.fire_at
      RETURNING jsonb_array_length(items) AS item_count
    `,
    [listId, actorUserId, fireAt, JSON.stringify([entryText]), now]
  );

  logger.info(
    { listId, actorUserId, fireAt, itemCount: result.rows[0]?.item_count ?? 1 },
    "Push job enqueued"
  );
}

/**
 * Starts the background loop that sends due push jobs.
 *
 * Ticks are chained with `setTimeout`: the next tick is only scheduled after the current one
 * settled, so a slow tick can never overlap with the next one.
 *
 * @param {object} [options] Worker options.
 * @returns {() => void} Function that stops the worker and cancels the pending timer.
 */
export function startPushWorker({
  pool = getPool(),
  config = getConfig(),
  webpushLib = webpush,
  now = () => new Date(),
  intervalMs = 5000,
  logger = defaultLogger
} = {}) {
  logger.info({ intervalMs }, "Push worker started");
  let stopped = false;
  let timer;

  const schedule = () => {
    if (stopped) {
      return;
    }

    timer = setTimeout(runTick, intervalMs);

    if (typeof timer.unref === "function") {
      timer.unref();
    }
  };

  async function runTick() {
    try {
      await processPendingPushJobs({ pool, config, webpushLib, now, logger });
    } catch (error) {
      logger.error({ err: error }, "Push worker tick failed");
    }

    schedule();
  }

  schedule();

  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

export async function processPendingPushJobs({
  pool = getPool(),
  config = getConfig(),
  webpushLib = webpush,
  now = () => new Date(),
  logger = defaultLogger
} = {}) {
  if (!pool) {
    return;
  }

  const missingConfig = getMissingVapidConfigFields(config);

  if (missingConfig.length) {
    logger.warn(
      { missingConfig },
      "Push worker skipped because VAPID configuration is incomplete"
    );
    return;
  }

  webpushLib.setVapidDetails(
    config.vapidContact,
    config.vapidPublicKey,
    config.vapidPrivateKey
  );

  // Claim due jobs by deleting them in one statement. SKIP LOCKED lets concurrent workers pick
  // disjoint jobs, and items enqueued after the claim create a fresh row instead of being lost.
  const jobsResult = await pool.query(
    `
      DELETE FROM pending_push_jobs
      WHERE id IN (
        SELECT id
        FROM pending_push_jobs
        WHERE fire_at <= $1
        ORDER BY fire_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 50
      )
      RETURNING id, list_id, actor_user_id, items
    `,
    [now()]
  );
  logger.debug(
    { dueJobCount: jobsResult.rows.length },
    "Push worker tick loaded due jobs"
  );

  for (const job of jobsResult.rows) {
    const currentTime = now();
    logger.info(
      { jobId: job.id, listId: job.list_id },
      "Push job fired"
    );
    const cooldownResult = await pool.query(
      `
        SELECT last_sent_at
        FROM push_cooldowns
        WHERE list_id = $1
        LIMIT 1
      `,
      [job.list_id]
    );

    const cooldown = cooldownResult.rows[0];

    if (
      cooldown &&
      new Date(cooldown.last_sent_at).getTime() > addMinutes(currentTime, -15).getTime()
    ) {
      logger.debug(
        { jobId: job.id, listId: job.list_id },
        "Push job skipped because cooldown is active"
      );
      continue;
    }

    const recipientsResult = await pool.query(
      `
        SELECT
          l.name AS list_name,
          actor.display_name AS actor_name,
          recipient.user_id
        FROM lists l
        JOIN users actor ON actor.id = $2
        JOIN (
          SELECT owner_id AS user_id
          FROM lists
          WHERE id = $1
          UNION
          SELECT user_id
          FROM list_members
          WHERE list_id = $1
        ) recipient ON true
        WHERE l.id = $1
          AND recipient.user_id <> $2
      `,
      [job.list_id, job.actor_user_id]
    );

    if (!recipientsResult.rows.length) {
      logger.info(
        { jobId: job.id, listId: job.list_id },
        "Push job skipped because no recipients are available"
      );
      continue;
    }

    logger.info(
      {
        jobId: job.id,
        listId: job.list_id,
        recipientCount: recipientsResult.rows.length
      },
      "Push recipients found"
    );

    const subscriptionsResult = await pool.query(
      `
        SELECT id, endpoint, p256dh, auth
        FROM push_subscriptions
        WHERE user_id = ANY($1)
      `,
      [recipientsResult.rows.map((row) => row.user_id)]
    );

    if (!subscriptionsResult.rows.length) {
      logger.info(
        {
          jobId: job.id,
          listId: job.list_id,
          recipientCount: recipientsResult.rows.length
        },
        "Push job has no subscriptions to notify"
      );
    } else {
      logger.info(
        {
          jobId: job.id,
          listId: job.list_id,
          subscriptionCount: subscriptionsResult.rows.length
        },
        "Push subscriptions targeted"
      );
    }

    const { list_name: listName, actor_name: actorName } = recipientsResult.rows[0];
    const items = normalizeJobItems(job.items);
    let notificationsSent = 0;
    let subscriptionsExpired = 0;
    const payload = {
      title: listName,
      body: buildNotificationBody({ actorName, items }),
      listId: job.list_id
    };

    for (const subscription of subscriptionsResult.rows) {
      try {
        await webpushLib.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth
            }
          },
          JSON.stringify(payload)
        );
        notificationsSent += 1;
      } catch (error) {
        // 404 and 410 mean the push service no longer knows this subscription.
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await pool.query(
            `
              DELETE FROM push_subscriptions
              WHERE endpoint = $1
            `,
            [subscription.endpoint]
          );
          subscriptionsExpired += 1;
          logger.info(
            { endpoint: truncateEndpoint(subscription.endpoint) },
            "Push subscription expired"
          );
          continue;
        }

        // Any other failure affects this subscription only; the remaining ones are still served.
        logger.warn(
          {
            endpoint: truncateEndpoint(subscription.endpoint),
            statusCode: error?.statusCode,
            err: error
          },
          "Push notification failed"
        );
      }
    }

    logger.info(
      {
        jobId: job.id,
        listId: job.list_id,
        notificationsSent,
        subscriptionsExpired
      },
      "Push notifications sent"
    );
    await pool.query(
      `
        INSERT INTO push_cooldowns (list_id, last_sent_at)
        VALUES ($1, $2)
        ON CONFLICT (list_id)
        DO UPDATE SET last_sent_at = EXCLUDED.last_sent_at
      `,
      [job.list_id, currentTime]
    );
    logger.info(
      {
        jobId: job.id,
        listId: job.list_id,
        notificationsSent,
        subscriptionsExpired
      },
      "Push job processed"
    );
  }
}

function normalizeJobItems(items) {
  // jsonb columns arrive from pg already parsed; anything else is treated as empty.
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter((item) => typeof item === "string" && item.trim());
}

function buildNotificationBody({ actorName, items }) {
  if (items.length <= 1) {
    return `${actorName} added ${items[0] ?? "an item"}`;
  }

  const remainingItemCount = items.length - 1;
  const itemLabel = remainingItemCount === 1 ? "item" : "items";

  return `${items[0]} and ${remainingItemCount} more ${itemLabel}`;
}

export function getMissingVapidConfigFields(config = {}) {
  return [
    ["vapidPublicKey", config.vapidPublicKey],
    ["vapidPrivateKey", config.vapidPrivateKey],
    ["vapidContact", config.vapidContact]
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function truncateEndpoint(endpoint) {
  if (typeof endpoint !== "string") {
    return "";
  }

  return endpoint.slice(0, 60);
}
