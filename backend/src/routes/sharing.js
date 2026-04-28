import { randomUUID } from "node:crypto";
import { Router } from "express";
import { getPool } from "../db/client.js";
import { getConfig } from "../env.js";
import createMailer from "../mail/mailer.js";
import { requireAuth } from "../middleware/auth.js";

export function createSharingRouter({
  pool = getPool(),
  requireAuthMiddleware = requireAuth,
  config = getConfig(),
  mailer = createMailer({ config }),
  generateInviteToken = randomUUID,
  now = () => new Date()
} = {}) {
  const router = Router({ mergeParams: true });

  router.use(requireAuthMiddleware);

  router.get("/", async (req, res, next) => {
    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const list = await getOwnedList(pool, req.params.id, req.user.sub);

      if (!list) {
        res.status(403).json({ error: "Only the list owner can manage sharing." });
        return;
      }

      const membersResult = await pool.query(
        `
          SELECT
            u.id AS user_id,
            u.display_name,
            u.email,
            lm.joined_at
          FROM list_members lm
          JOIN users u ON u.id = lm.user_id
          WHERE lm.list_id = $1
          ORDER BY lm.joined_at ASC
        `,
        [req.params.id]
      );

      res.json({
        members: [
          {
            user_id: list.owner_id,
            display_name: list.owner_display_name,
            email: list.owner_email,
            joined_at: list.created_at,
            is_owner: true
          },
          ...membersResult.rows.map((row) => ({
            user_id: row.user_id,
            display_name: row.display_name,
            email: row.email,
            joined_at: row.joined_at,
            is_owner: false
          }))
        ]
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    const email = req.body?.email?.trim();

    if (!email) {
      res.status(400).json({ error: "Email is required." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const list = await getOwnedList(pool, req.params.id, req.user.sub);

      if (!list) {
        res.status(403).json({ error: "Only the list owner can manage sharing." });
        return;
      }

      const userResult = await pool.query(
        `
          SELECT id, display_name, email
          FROM users
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1
        `,
        [email]
      );

      const user = userResult.rows[0];

      if (user?.id === list.owner_id || email.toLowerCase() === list.owner_email.toLowerCase()) {
        res.status(409).json({ error: "That user already has access to this list." });
        return;
      }

      if (user) {
        const existingMemberResult = await pool.query(
          `
            SELECT user_id
            FROM list_members
            WHERE list_id = $1 AND user_id = $2
            LIMIT 1
          `,
          [req.params.id, user.id]
        );

        if (existingMemberResult.rows[0]) {
          res.status(409).json({ error: "That user already has access to this list." });
          return;
        }
      }

      const inviteToken = generateInviteToken();
      const expiresAt = addDays(now(), 7);
      const inviteResult = await pool.query(
        `
          INSERT INTO list_invites (list_id, invited_email, invited_by, token, expires_at)
          VALUES ($1, LOWER($2), $3, $4, $5)
          ON CONFLICT (list_id, invited_email) WHERE status = 'pending'
          DO UPDATE SET
            invited_by = EXCLUDED.invited_by,
            token = EXCLUDED.token,
            expires_at = EXCLUDED.expires_at
          RETURNING id, invited_email, status, expires_at
        `,
        [req.params.id, email, req.user.sub, inviteToken, expiresAt]
      );

      await sendInviteEmail({
        config,
        inviteToken,
        invitedEmail: email.toLowerCase(),
        inviterName: list.owner_display_name,
        listName: list.name,
        mailer,
        recipientName: user?.display_name ?? ""
      });

      res.status(201).json({
        invite: inviteResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:uid", async (req, res, next) => {
    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const list = await getOwnedList(pool, req.params.id, req.user.sub);

      if (!list) {
        res.status(403).json({ error: "Only the list owner can manage sharing." });
        return;
      }

      if (req.params.uid === list.owner_id) {
        res.status(400).json({ error: "The list owner cannot be removed." });
        return;
      }

      const deleteResult = await pool.query(
        `
          DELETE FROM list_members lm
          USING users u
          WHERE lm.list_id = $1
            AND lm.user_id = $2
            AND u.id = lm.user_id
          RETURNING lm.user_id, u.email, u.display_name
        `,
        [req.params.id, req.params.uid]
      );

      if (!deleteResult.rows[0]) {
        res.status(404).json({ error: "That member does not have access to this list." });
        return;
      }

      await sendRevocationEmail({
        listName: list.name,
        mailer,
        member: deleteResult.rows[0]
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

async function getOwnedList(pool, listId, ownerId) {
  const result = await pool.query(
    `
      SELECT
        l.id,
        l.name,
        l.owner_id,
        l.created_at,
        owner.display_name AS owner_display_name,
        owner.email AS owner_email
      FROM lists l
      JOIN users owner ON owner.id = l.owner_id
      WHERE l.id = $1 AND l.owner_id = $2
      LIMIT 1
    `,
    [listId, ownerId]
  );

  return result.rows[0] ?? null;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function buildAppUrl(baseUrl, path) {
  const normalizedBaseUrl = baseUrl?.replace(/\/$/, "") ?? "";

  return normalizedBaseUrl ? `${normalizedBaseUrl}${path}` : path;
}

async function sendInviteEmail({
  config,
  inviteToken,
  invitedEmail,
  inviterName,
  listName,
  mailer,
  recipientName
}) {
  const isExistingUserInvite = Boolean(recipientName);

  await mailer.send({
    to: invitedEmail,
    subject: isExistingUserInvite
      ? `${inviterName} shared ${listName} with you`
      : `${inviterName} invited you to ${listName}`,
    template: isExistingUserInvite ? "invite-existing" : "invite-new",
    context: isExistingUserInvite
      ? {
          heading: `${inviterName} shared a list with you`,
          intro: `Hi ${recipientName},`,
          body: `Open the invite below to access the shared list "${listName}".`,
          ctaLabel: "View list",
          ctaUrl: buildAppUrl(config.appBaseUrl, `/invite/${encodeURIComponent(inviteToken)}`),
          listName,
          inviterName
        }
      : {
          heading: "You are invited to Endgame Grocery",
          intro: "Hi there,",
          body: `Create your account to join the shared list "${listName}".`,
          ctaLabel: "Register",
          ctaUrl: buildAppUrl(
            config.appBaseUrl,
            `/register?invite=${encodeURIComponent(inviteToken)}`
          ),
          listName,
          inviterName
        }
  });
}

async function sendRevocationEmail({ listName, mailer, member }) {
  await mailer.send({
    to: member.email,
    subject: `Your access to ${listName} was removed`,
    template: "revocation",
    context: {
      heading: "List access removed",
      intro: `Hi ${member.display_name},`,
      body: `Your collaboration on the list "${listName}" has ended.`,
      listName
    }
  });
}

export default createSharingRouter;
