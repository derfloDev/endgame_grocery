# ROADMAP — Notifications & Mail Support

Goal: deliver transactional e-mail and push-notification infrastructure across five modules.

---

## Architectural Decisions (locked)

| Decision | Choice |
|---|---|
| Mail transport | Nodemailer + SMTP; config via docker-compose env vars |
| Mail templates | Handlebars (`.hbs` files, server-side rendered) |
| Token storage | New PostgreSQL tables (no Redis) |
| Push batching | DB-backed job queue (`pending_push_jobs` table), polled via `setInterval` in the Node process |
| Push protocol | Web Push (VAPID), extends the existing PWA service worker |
| Sharing acceptance | E-mail-link-only (H1): clicking the invite link = acceptance; no in-app inbox |
| New-user invite | `/invite/:token` route; completing registration via that token = acceptance |

---

## Module 1 — E-Mail Verification (Registration)

**Objective:** Ensure the e-mail address is real and welcome the user.

### Scope
- After `POST /api/auth/register` succeeds, send a verification e-mail instead of returning a ready-to-use token.
- Users table gains an `email_verified` boolean column (default `false`).
- New `email_verification_tokens` table: `id`, `user_id`, `token` (UUID), `expires_at` (24 h), `created_at`.
- New `GET /api/auth/verify-email?token=<uuid>` endpoint: validates token, sets `email_verified = true`, returns a JWT.
- Unverified accounts receive a 403 on all protected routes until verified.
- New frontend page: `VerifyEmailPage` – shown after registration (no token in URL) and after clicking the verify link.
- Resend-verification endpoint: `POST /api/auth/resend-verification`.
- Mail content: welcome greeting, app name ("Dein Einkaufsplaner"), single CTA button "E-Mail bestätigen".
- Sender display name: "Dein Einkaufsplaner".
- HTML template: responsive, single primary CTA, Handlebars.

### Acceptance Criteria
- Registering a new account sends exactly one verification e-mail.
- Clicking the link in the e-mail activates the account and issues a JWT.
- Expired/invalid tokens return a clear error message on the verify page.
- Unverified users get 403 on all protected API routes.
- SMTP credentials are read from env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
- `docker-compose.yml` documents the five SMTP env vars (commented-out example values).

---

## Module 2 — Password Reset

**Objective:** Allow users to securely recover account access.

### Scope
- New `password_reset_tokens` table: `id`, `user_id`, `token` (UUID), `expires_at` (60 min), `used` (boolean), `created_at`.
- New `POST /api/auth/forgot-password` endpoint: looks up user by email, creates a reset token, sends the mail. Always responds 200 (email enumeration prevention).
- New `POST /api/auth/reset-password` endpoint: validates token (not expired, not used), hashes new password, marks token used.
- New frontend pages:
  - `ForgotPasswordPage` – email input form, shows "If an account exists, you will receive an e-mail."
  - `ResetPasswordPage` – `/reset-password?token=<uuid>` – new-password form.
- Mail content: reset-link button, 60-minute expiry notice, "Dein Einkaufsplaner" sender.

### Acceptance Criteria
- Requesting a reset for a non-existent e-mail still returns 200 and sends no mail.
- The reset link expires after 60 minutes.
- A used token cannot be reused.
- After successful reset the user can log in with the new password.

---

## Module 3 — List Sharing via Invitation

**Objective:** Notify recipients about collaboration and require explicit acceptance.

### Scope

#### Sharing flow change (acceptance required)
- `POST /api/lists/:id/sharing` no longer immediately adds the member.
- Instead, it creates a pending invite record in `list_invites` table: `id`, `list_id`, `invited_email`, `invited_by` (user_id), `token` (UUID), `status` (`pending`/`accepted`/`declined`), `expires_at` (7 days), `created_at`.
- An invitation e-mail is sent to the address.

#### Scenario A — Recipient is an existing user
- Mail: "[Sender] hat die Liste '[Name]' mit dir geteilt." + CTA "Liste ansehen" → `/invite/:token`.
- `GET /api/invites/:token` (authenticated): validates token, adds user as list member, marks invite `accepted`, redirects to list.

#### Scenario B — Recipient is a new user
- Mail: "[Sender] lädt dich ein, die Liste '[Name]' zu sehen. Registriere dich, um beizutreten." + CTA "Registrieren" → `/register?invite=<token>`.
- After successful registration with that token: token is consumed, user is added to the list, redirected to the list detail page.

#### Sharing revocation notification
- `DELETE /api/lists/:id/sharing/:userId`: existing endpoint; additionally sends a short revocation mail to the removed member.
- Mail content: "Deine Zusammenarbeit an der Liste '[Name]' wurde beendet."

### Acceptance Criteria
- `POST /api/lists/:id/sharing` no longer immediately adds the member; instead, a `list_invites` row is created and the invite mail is sent.
- Existing user clicking the invite link is added to the list (idempotent if already a member).
- New user registers via invite link → automatically added to the list and redirected to it.
- Invite tokens expire after 7 days.
- Revoked members receive a notification e-mail.
- Duplicate invite to the same email on the same list re-sends the mail and resets expiry rather than creating a second row.

---

## Module 4 — UX / Design Constraints (cross-cutting)

Applies to all mail templates:
- Sender name: "Dein Einkaufsplaner" (configured via `SMTP_FROM_NAME` env var).
- Single primary CTA per mail.
- Responsive HTML (mobile-first, inline styles for e-mail client compatibility).
- All Handlebars templates live in `backend/src/mail/templates/`.
- A shared `base.hbs` layout provides header/footer/button styling.

---

## Module 5 — Push Notifications: Activity Updates

**Objective:** Notify shared-list members about new entries without spam.

### Scope

#### Backend
- New `push_subscriptions` table: `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `created_at`.
- New `POST /api/push/subscribe` endpoint: saves Web Push subscription for the authenticated user.
- New `DELETE /api/push/subscribe` endpoint: removes subscription.
- VAPID keys stored as `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` env vars.
- New `pending_push_jobs` table: `id`, `list_id`, `actor_user_id`, `fire_at` (timestamp), `items` (JSONB array of entry texts), `created_at`.
- On `POST /api/lists/:id/entries` (successful entry creation):
  - If a `pending_push_jobs` row exists for `(list_id, actor_user_id)` and `fire_at` is in the future → append the new entry text to `items`, update `fire_at` to `now() + 5 min`.
  - Otherwise → insert a new job row with `fire_at = now() + 5 min`.
- A `setInterval` worker (5-second poll) processes jobs where `fire_at <= now()`:
  - Fetches all list members except `actor_user_id`.
  - Skips members whose list has an active cooldown (`push_cooldowns` table: `list_id`, `last_sent_at`; cooldown = 15 min per list, unless the actor differs).
  - Sends Web Push to all eligible subscribers.
  - Deletes the job row.
  - Upserts `push_cooldowns` with `last_sent_at = now()`.
- Notification body:
  - 1 item: `"[Name] hat '[item]' zur Liste [Listenname] hinzugefügt."`
  - 2+ items: `"[Name] hat '[first item]' und [N-1] weitere Artikel zur Liste [Listenname] hinzugefügt."`

#### Frontend
- Extend the PWA service worker (`sw/`) to handle `push` events: show a system notification.
- New `usePushNotifications` hook:
  - Requests notification permission.
  - Creates a `PushSubscription` using the VAPID public key.
  - Calls `POST /api/push/subscribe`.
  - Exposes `isSubscribed`, `subscribe()`, `unsubscribe()`.
- New opt-in UI: a small toggle/button on the list detail page header ("Benachrichtigungen aktivieren"). Only shown for shared lists where the user is not the owner.
- VAPID public key exposed at `GET /api/push/vapid-public-key` (unauthenticated).

### Acceptance Criteria
- Subscribing stores a `push_subscriptions` row; unsubscribing removes it.
- Adding one entry triggers a single push after ≤ 10 minutes.
- Adding three entries within the 5-minute window → one batched notification listing the first item + "2 weitere Artikel".
- The notification actor never receives their own notification.
- A second batch within 15 minutes of the last send for the same list is suppressed (cooldown).
- Notification permission UI only appears for shared lists.
- VAPID keys are read from env vars; `docker-compose.yml` documents them.

---

## Out of Scope (this cycle)
- In-app notification inbox / bell icon
- E-mail preferences / unsubscribe management
- Mobile native push (FCM/APNs) — Web Push only
- Admin dashboard for mail delivery status
