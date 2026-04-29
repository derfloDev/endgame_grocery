import webpush from "web-push";
import { getPool } from "../db/client.js";
import { getConfig } from "../env.js";
import { logger as defaultLogger } from "../logger.js";

export async function enqueuePushJob({
  pool,
  listId,
  actorUserId,
  entryText,
  now = new Date()
}) {
  const existingResult = await pool.query(
    `
      SELECT id, items, fire_at
      FROM pending_push_jobs
      WHERE list_id = $1 AND actor_user_id = $2
      LIMIT 1
    `,
    [listId, actorUserId]
  );

  const existingJob = existingResult.rows[0];
  const fireAt = addMinutes(now, 5);

  if (!existingJob) {
    await pool.query(
      `
        INSERT INTO pending_push_jobs (list_id, actor_user_id, fire_at, items)
        VALUES ($1, $2, $3, $4)
      `,
      [listId, actorUserId, fireAt, [entryText]]
    );
    return;
  }

  const isPendingWindowActive = new Date(existingJob.fire_at).getTime() > now.getTime();
  const nextItems = isPendingWindowActive
    ? [...normalizeJobItems(existingJob.items), entryText]
    : [entryText];

  await pool.query(
    `
      UPDATE pending_push_jobs
      SET items = $1, fire_at = $2
      WHERE id = $3
    `,
    [nextItems, fireAt, existingJob.id]
  );
}

export function startPushWorker({
  pool = getPool(),
  config = getConfig(),
  webpushLib = webpush,
  now = () => new Date(),
  intervalMs = 5000,
  logger = defaultLogger
} = {}) {
  logger.info({ intervalMs }, "Push worker started");
  const timer = setInterval(() => {
    void processPendingPushJobs({ pool, config, webpushLib, now, logger }).catch((error) => {
      logger.error({ err: error }, "Push worker tick failed");
    });
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return () => clearInterval(timer);
}

export async function processPendingPushJobs({
  pool = getPool(),
  config = getConfig(),
  webpushLib = webpush,
  now = () => new Date(),
  logger = defaultLogger
} = {}) {
  if (
    !pool ||
    !config.vapidPublicKey ||
    !config.vapidPrivateKey ||
    !config.vapidContact
  ) {
    return;
  }

  webpushLib.setVapidDetails(
    config.vapidContact,
    config.vapidPublicKey,
    config.vapidPrivateKey
  );

  const jobsResult = await pool.query(
    `
      SELECT id, list_id, actor_user_id, items
      FROM pending_push_jobs
      WHERE fire_at <= $1
      ORDER BY fire_at ASC
    `,
    [now()]
  );

  for (const job of jobsResult.rows) {
    const currentTime = now();
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
      await deletePushJob(pool, job.id);
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
      await deletePushJob(pool, job.id);
      logger.debug(
        { jobId: job.id, listId: job.list_id },
        "Push job skipped because no recipients are available"
      );
      continue;
    }

    const subscriptionsResult = await pool.query(
      `
        SELECT id, endpoint, p256dh, auth
        FROM push_subscriptions
        WHERE user_id = ANY($1)
      `,
      [recipientsResult.rows.map((row) => row.user_id)]
    );

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
        if (error?.statusCode === 410) {
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

        throw error;
      }
    }

    await deletePushJob(pool, job.id);
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
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter((item) => typeof item === "string" && item.trim());
}

function buildNotificationBody({ actorName, items }) {
  if (items.length <= 1) {
    return `${actorName} added ${items[0] ?? "an item"}`;
  }

  return `${items[0]} und ${items.length - 1} weitere Artikel`;
}

async function deletePushJob(pool, jobId) {
  await pool.query(
    `
      DELETE FROM pending_push_jobs
      WHERE id = $1
    `,
    [jobId]
  );
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
