# Plan — Notifications & Mail Support

Status: **ready_for_implement**

Goal: implement the five modules defined in `ROADMAP.md` — e-mail verification, password reset, list-sharing invitations, shared mail design system, and push notifications.

---

## Scope

Six deliverables in dependency order:

| Task | Module | Depends on |
|---|---|---|
| T-001 | Mail + package infrastructure (M4 base) | — |
| T-002 | E-mail verification (M1) | T-001 |
| T-003 | Password reset (M2) | T-001 |
| T-004 | List sharing via invitation (M3) | T-001 |
| T-005 | Push notifications (M5) | — |
| T-006 | Fix Docker publish pipeline (CI/CD) | — |

---

## Architecture Notes

### SMTP / Mailer module
- Single `backend/src/mail/mailer.js` module that owns the Nodemailer transport.
- `createMailer({ config })` factory (matches the project's dependency-injection pattern).
- `mailer.send({ to, subject, template, context })` — renders a Handlebars template from `backend/src/mail/templates/` and sends.
- Templates extend `base.hbs` via Handlebars partials (`{{> base content=...}}`).
- `APP_BASE_URL` env var used to build all links inside mails.

### Auth route extensions (T-002, T-003)
All new endpoints are added to the existing `createAuthRouter` in `backend/src/routes/auth.js`.

### Email-verified guard
Login (`POST /api/auth/login`) checks `email_verified`; if `false`, returns `403 { error: "Please verify your email before logging in." }`.
JWT issuance itself enforces the gate — no extra DB hit in middleware.

### Existing-user migration (T-002)
The `email_verified` column is added as `DEFAULT true` so existing rows are auto-verified. New registrations insert `email_verified = false`.

### Invite + registration fusion (T-004)
If `POST /api/auth/register` receives a valid `invite_token` body field:
- The new user is inserted with `email_verified = true` (email ownership proved via invite link).
- The invite is consumed and the user is added to the list.
- A JWT is returned directly (skipping the normal verify-email flow).

### Service worker for push (T-005)
`vite-plugin-pwa` is switched from `generateSW` (current) to `injectManifest` mode.
A custom SW entry `frontend/src/sw/service-worker.js` is created; it imports Workbox precaching plus a `push` event handler.
The existing `frontend/src/sw/register.js` is unchanged.

---

## Phase 1 — T-001: Mail + Package Infrastructure

### What to build
1. Install packages: `nodemailer`, `handlebars` (production); update root `package.json`.
2. `backend/src/mail/mailer.js` — Nodemailer transport factory + `send()` helper.
3. `backend/src/mail/templates/base.hbs` — shared responsive HTML layout (header with app name, content slot, CTA button partial, footer). Inline CSS for e-mail client compatibility.
4. `backend/src/env.js` — add `smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`, `smtpFrom`, `smtpFromName`, `appBaseUrl` to `getConfig()`.
5. `docker-compose.yml` — add commented env var block for the backend service documenting all seven new vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`, `APP_BASE_URL`).

### Files to change
| File | Action |
|---|---|
| `package.json` | add `nodemailer`, `handlebars` to dependencies |
| `backend/src/mail/mailer.js` | create |
| `backend/src/mail/templates/base.hbs` | create |
| `backend/src/env.js` | extend `getConfig()` |
| `docker-compose.yml` | add commented SMTP env block |

### Acceptance Criteria
- `mailer.send()` resolves without throwing when pointed at a real SMTP server.
- `getConfig()` returns all seven new fields.
- `docker-compose.yml` contains all seven env var names as comments.
- `npm run lint` passes.

---

## Phase 2 — T-002: E-Mail Verification

### What to build

**DB migration** `<ts>_add_email_verification.cjs`
- `ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT true` (existing rows auto-verified).
- New table `email_verification_tokens(id uuid PK, user_id uuid FK→users ON DELETE CASCADE, token uuid UNIQUE, expires_at timestamptz, created_at timestamptz DEFAULT NOW())`.

**Backend** (`backend/src/routes/auth.js`)
- `POST /register`: insert user with `email_verified = false`; do **not** return a JWT; call `mailer.send()` with `verification.hbs`; return `201 { message: "Verification email sent." }`.
- `POST /login`: add check — if `email_verified = false`, return `403 { error: "Please verify your email before logging in." }`.
- `GET /verify-email?token=<uuid>`: look up token in `email_verification_tokens`, check expiry, set `email_verified = true`, delete token row, return `200 { token: <JWT> }`. Invalid/expired → `400`.
- `POST /resend-verification`: accept `{ email }` body; look up user; if unverified, delete old tokens for that user, create new token, send mail; always return `200`.

**Mail template** `backend/src/mail/templates/verification.hbs`
- Subject: "Bitte bestätige deine E-Mail-Adresse"
- Body: welcome greeting, app name, single CTA "E-Mail bestätigen" linking to `APP_BASE_URL/verify-email?token=<token>`.

**Frontend**
- `frontend/src/api/auth.js` — add `verifyEmail(token)` (`GET /api/auth/verify-email?token=`), `resendVerification(email)` (`POST /api/auth/resend-verification`).
- `frontend/src/context/AuthContext.jsx` — `register()` no longer calls `login()` after register; returns the raw API response (implementer: no token to store).
- `frontend/src/pages/RegisterPage.jsx` — after successful `register()`, `navigate("/verify-email")` instead of `"/"`.
- `frontend/src/pages/VerifyEmailPage.jsx` — new public page:
  - No `?token` in URL → shows "Check your inbox" message + "Resend" button (calls `resendVerification`).
  - `?token=<uuid>` in URL → on mount calls `verifyEmail(token)`; on success stores JWT via `AuthContext` + `navigate("/")`.  On error shows message + resend option.
- `frontend/src/App.jsx` — add `/verify-email` as a public route (outside `ProtectedLayout`).

### Files to change
| File | Action |
|---|---|
| `backend/src/db/migrations/<ts>_add_email_verification.cjs` | create |
| `backend/src/routes/auth.js` | modify register + login; add verify-email + resend |
| `backend/src/mail/templates/verification.hbs` | create |
| `frontend/src/api/auth.js` | add `verifyEmail`, `resendVerification` |
| `frontend/src/context/AuthContext.jsx` | update `register()` |
| `frontend/src/pages/RegisterPage.jsx` | update post-register redirect |
| `frontend/src/pages/VerifyEmailPage.jsx` | create |
| `frontend/src/App.jsx` | add `/verify-email` route |

### Acceptance Criteria
- New registration sends exactly one verification e-mail and returns no JWT.
- Login with unverified account → 403.
- Valid token → JWT issued, `email_verified = true` in DB.
- Expired/invalid token → 400, error shown on `VerifyEmailPage`.
- Resend creates new token, deletes old ones.
- Existing DB users (migration) remain `email_verified = true`.

---

## Phase 3 — T-003: Password Reset

### What to build

**DB migration** `<ts>_add_password_reset_tokens.cjs`
- New table `password_reset_tokens(id uuid PK, user_id uuid FK→users ON DELETE CASCADE, token uuid UNIQUE, expires_at timestamptz, used boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT NOW())`.

**Backend** (`backend/src/routes/auth.js`)
- `POST /forgot-password`: accept `{ email }`; look up user; if found and `email_verified = true`, insert token with `expires_at = NOW() + 60 min`, send `password-reset.hbs`; **always** return `200 { message: "If an account exists, you will receive an email." }`.
- `POST /reset-password`: accept `{ token, password }`; validate token (exists, not expired, not used); hash new password; update user; mark token `used = true`; return `200 { message: "Password updated." }`. Invalid → `400`.

**Mail template** `backend/src/mail/templates/password-reset.hbs`
- Subject: "Passwort zurücksetzen"
- Body: single CTA "Passwort zurücksetzen" → `APP_BASE_URL/reset-password?token=<token>`, note that link expires in 60 minutes.

**Frontend**
- `frontend/src/api/auth.js` — add `forgotPassword(email)`, `resetPassword(token, newPassword)`.
- `frontend/src/pages/ForgotPasswordPage.jsx` — email input form; on submit shows static success message regardless of outcome.
- `frontend/src/pages/ResetPasswordPage.jsx` — reads `?token` from URL; new-password form; on success `navigate("/login")` with success message.
- `frontend/src/pages/LoginPage.jsx` — add "Passwort vergessen?" link to `/forgot-password`.
- `frontend/src/App.jsx` — add `/forgot-password` and `/reset-password` as public routes.

### Files to change
| File | Action |
|---|---|
| `backend/src/db/migrations/<ts>_add_password_reset_tokens.cjs` | create |
| `backend/src/routes/auth.js` | add forgot-password + reset-password |
| `backend/src/mail/templates/password-reset.hbs` | create |
| `frontend/src/api/auth.js` | add `forgotPassword`, `resetPassword` |
| `frontend/src/pages/ForgotPasswordPage.jsx` | create |
| `frontend/src/pages/ResetPasswordPage.jsx` | create |
| `frontend/src/pages/LoginPage.jsx` | add forgot-password link |
| `frontend/src/App.jsx` | add `/forgot-password`, `/reset-password` routes |

### Acceptance Criteria
- `POST /forgot-password` with unknown e-mail returns 200 and sends no mail.
- Reset link expires after 60 minutes → `400` on the endpoint.
- Used token cannot be reused.
- Successful reset: user can log in with new password.

---

## Phase 4 — T-004: List Sharing via Invitation

### What to build

**DB migration** `<ts>_add_list_invites.cjs`
- New table `list_invites(id uuid PK, list_id uuid FK→lists ON DELETE CASCADE, invited_email text NOT NULL, invited_by uuid FK→users ON DELETE CASCADE, token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(), status text NOT NULL DEFAULT 'pending', expires_at timestamptz NOT NULL, created_at timestamptz DEFAULT NOW())`.
- Constraint: `status IN ('pending', 'accepted', 'declined')`.
- Unique index on `(list_id, invited_email)` where `status = 'pending'` (partial index) — enforces one active invite per email+list.

**Backend — sharing route** (`backend/src/routes/sharing.js`)
- `POST /` (invite): **replace** current direct-add with invite flow:
  - Check list ownership (unchanged).
  - Look up user by email to determine Scenario A vs B.
  - Upsert `list_invites` — if a `pending` row already exists for `(list_id, invited_email)`: update `token = gen_random_uuid()`, `expires_at = NOW() + 7d`; otherwise insert.
  - Send `invite-existing.hbs` (Scenario A: user exists) or `invite-new.hbs` (Scenario B: no user).
  - Return `201 { invite: { id, invited_email, status, expires_at } }`.
- `DELETE /:uid` (revoke): after successful member deletion, fetch removed user's email + list name, send `revocation.hbs`.

**Backend — invites route** (new `backend/src/routes/invites.js`)
- `GET /api/invites/:token` (`requireAuth` middleware):
  - Look up invite by token; check expiry and `status = 'pending'`.
  - Verify `req.user` email matches `invited_email` (or skip check — implementer's choice based on security posture; recommended: skip to keep UX simple, token is the secret).
  - Insert into `list_members`; mark invite `accepted`.
  - Return `200 { listId }` (frontend redirects to `/lists/:listId`).
  - Already-a-member: return `200 { listId }` (idempotent).

**Backend — register with invite** (`backend/src/routes/auth.js`)
- `POST /register`: if body contains `invite_token`:
  - Look up invite; if valid `pending` invite: insert user with `email_verified = true`, consume invite (add to `list_members`, mark `accepted`), return JWT directly.
  - If invite invalid/expired: continue with normal register flow (no JWT, send verification mail).

**Backend — app.js**: register `GET /api/invites/:token` via new invites router.

**Mail templates**
- `backend/src/mail/templates/invite-existing.hbs` — "[Sender] hat die Liste '[Name]' mit dir geteilt." + CTA "Liste ansehen" → `APP_BASE_URL/invite/:token`.
- `backend/src/mail/templates/invite-new.hbs` — "[Sender] lädt dich ein, die Liste '[Name]' zu sehen." + CTA "Registrieren" → `APP_BASE_URL/register?invite=<token>`.
- `backend/src/mail/templates/revocation.hbs` — "Deine Zusammenarbeit an der Liste '[Name]' wurde beendet."

**Frontend**
- `frontend/src/pages/InviteAcceptPage.jsx` — new public page at `/invite/:token`:
  - If `token` in context (user logged in): on mount calls `acceptInvite(token)`; on success `navigate("/lists/:listId")`.
  - If user not logged in: `navigate("/login?redirect=/invite/:token")` (login page handles `?redirect` param).
- `frontend/src/pages/RegisterPage.jsx` — read `?invite=<token>` from URL; pass `invite_token` to `registerUser()`; after successful registration with invite (response contains `token`), store JWT and `navigate("/lists/:listId")`; without invite, keep existing flow.
- `frontend/src/pages/LoginPage.jsx` — after login, check for `?redirect=` param and navigate there.
- `frontend/src/api/sharing.js` — add `acceptInvite(token)` (`GET /api/invites/:token`); update `shareListWithMember` JSDoc to reflect new response shape.
- `frontend/src/api/auth.js` — `registerUser` accepts optional `invite_token` in payload.
- `frontend/src/App.jsx` — add `/invite/:token` as a public route (renders `InviteAcceptPage`).
- `frontend/src/components/ShareListSheet.jsx` (or wherever sharing UI lives) — update to handle `invite` response shape (show "Invitation sent to [email]" instead of adding member to list immediately).

### Files to change
| File | Action |
|---|---|
| `backend/src/db/migrations/<ts>_add_list_invites.cjs` | create |
| `backend/src/routes/sharing.js` | replace POST logic; extend DELETE with revocation mail |
| `backend/src/routes/invites.js` | create |
| `backend/src/routes/auth.js` | extend register with invite_token handling |
| `backend/src/app.js` | register invites router |
| `backend/src/mail/templates/invite-existing.hbs` | create |
| `backend/src/mail/templates/invite-new.hbs` | create |
| `backend/src/mail/templates/revocation.hbs` | create |
| `frontend/src/pages/InviteAcceptPage.jsx` | create |
| `frontend/src/pages/RegisterPage.jsx` | handle `?invite=` param |
| `frontend/src/pages/LoginPage.jsx` | handle `?redirect=` param |
| `frontend/src/api/sharing.js` | add `acceptInvite`; update JSDoc |
| `frontend/src/api/auth.js` | extend `registerUser` payload |
| `frontend/src/App.jsx` | add `/invite/:token` route |
| `frontend/src/components/ShareListSheet.jsx` | update for invite response shape |

### Acceptance Criteria
- `POST /api/lists/:id/members` no longer adds the member directly; creates invite row + sends mail.
- Existing user clicks invite link → added to list, redirected to list.
- New user registers via `?invite=<token>` → `email_verified = true`, JWT returned, redirected to list.
- Invite tokens expire after 7 days.
- Duplicate invite to same email on same list resets the token and resends.
- Revoked member receives revocation mail.
- ShareListSheet shows "invitation sent" state.

---

## Phase 5 — T-005: Push Notifications

### What to build

**Package**
- Install `web-push` (production dependency); update root `package.json`.

**DB migration** `<ts>_add_push_tables.cjs`
- `push_subscriptions(id uuid PK, user_id uuid FK→users ON DELETE CASCADE, endpoint text NOT NULL, p256dh text NOT NULL, auth text NOT NULL, created_at timestamptz DEFAULT NOW())`.
- Unique constraint on `(user_id, endpoint)`.
- `pending_push_jobs(id uuid PK, list_id uuid FK→lists ON DELETE CASCADE, actor_user_id uuid FK→users ON DELETE CASCADE, fire_at timestamptz NOT NULL, items jsonb NOT NULL DEFAULT '[]', created_at timestamptz DEFAULT NOW())`.
- Unique constraint on `(list_id, actor_user_id)`.
- `push_cooldowns(list_id uuid PK FK→lists ON DELETE CASCADE, last_sent_at timestamptz NOT NULL)`.

**Backend — push route** (new `backend/src/routes/push.js`)
- `GET /api/push/vapid-public-key` (no auth): returns `{ publicKey: config.vapidPublicKey }`.
- `POST /api/push/subscribe` (`requireAuth`): upsert into `push_subscriptions`.
- `DELETE /api/push/subscribe` (`requireAuth`): delete row matching `(user_id, endpoint)`.

**Backend — push worker** (new `backend/src/workers/pushWorker.js`)
- Exports `startPushWorker({ pool, config })`.
- `setInterval` every 5 seconds:
  1. `SELECT ... FROM pending_push_jobs WHERE fire_at <= NOW() FOR UPDATE SKIP LOCKED` — process one batch at a time.
  2. For each job:
     - Check `push_cooldowns` for `(list_id)`: if `last_sent_at > NOW() - 15 min` AND actor is same user — skip (cooldown active).
     - Fetch all list members except `actor_user_id` (owner + `list_members`).
     - Fetch `push_subscriptions` for those users.
     - Compose notification body (1-item vs multi-item format).
     - Send Web Push via `webpush.sendNotification()` to each subscriber; swallow 410 Gone (remove stale subscriptions).
     - Delete job row.
     - Upsert `push_cooldowns`.

**Backend — env.js**: add `vapidPublicKey`, `vapidPrivateKey`, `vapidContact` to `getConfig()`.

**Backend — entries route** (`backend/src/routes/entries.js`)
- In `POST /` handler, after successful entry insertion: call `enqueuePushJob({ pool, listId, actorUserId, entryText })` (extracted helper, importable).
- Helper: upsert `pending_push_jobs` — if row exists for `(list_id, actor_user_id)` with `fire_at > NOW()`: append entry to `items` JSONB, update `fire_at = NOW() + 5 min`; else: insert new row.

**Backend — app.js**: register push router; call `startPushWorker()` (skip in test env: `if (process.env.NODE_ENV !== 'test')`).

**docker-compose.yml**: add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT` commented env vars.

**Frontend — Vite config** (`frontend/vite.config.js`)
- Switch `VitePWA` from `generateSW` to `injectManifest` mode:
  ```js
  strategies: 'injectManifest',
  srcDir: 'src/sw',
  filename: 'service-worker.js',
  ```
- Remove `workbox` key; add `injectManifest: { globPatterns: [...] }`.

**Frontend — custom SW** (new `frontend/src/sw/service-worker.js`)
- Import and call `precacheAndRoute(self.__WB_MANIFEST)` (Workbox precaching, replaces current generated SW behaviour).
- Add `push` event listener: parse `event.data.json()`, call `self.registration.showNotification(title, { body, icon })`.
- Add `notificationclick` listener: focus/open the app.

**Frontend — push API** (new `frontend/src/api/push.js`)
- `fetchVapidPublicKey()` — `GET /api/push/vapid-public-key`.
- `subscribePush(token, subscription)` — `POST /api/push/subscribe`.
- `unsubscribePush(token, endpoint)` — `DELETE /api/push/subscribe`.

**Frontend — hook** (new `frontend/src/hooks/usePushNotifications.js`)
- Fetches VAPID key on mount.
- `subscribe()`: requests `Notification.permission`, creates `PushSubscription`, calls `subscribePush`.
- `unsubscribe()`: calls browser `unsubscribe()` + `unsubscribePush`.
- Exposes `{ isSubscribed, isSupported, subscribe, unsubscribe }`.

**Frontend — ListDetailPage** (`frontend/src/pages/ListDetailPage.jsx`)
- Use `usePushNotifications` hook.
- Show "Benachrichtigungen aktivieren / deaktivieren" toggle in the top bar area, **only** when the list has other members (i.e., it is a shared list and `members.length > 1`).

### Files to change
| File | Action |
|---|---|
| `package.json` | add `web-push` to dependencies |
| `backend/src/db/migrations/<ts>_add_push_tables.cjs` | create |
| `backend/src/routes/push.js` | create |
| `backend/src/workers/pushWorker.js` | create |
| `backend/src/routes/entries.js` | add push job enqueue after POST |
| `backend/src/app.js` | register push router + start push worker |
| `backend/src/env.js` | add VAPID fields |
| `docker-compose.yml` | add VAPID env vars |
| `frontend/vite.config.js` | switch to injectManifest mode |
| `frontend/src/sw/service-worker.js` | create (custom SW entry) |
| `frontend/src/api/push.js` | create |
| `frontend/src/hooks/usePushNotifications.js` | create |
| `frontend/src/pages/ListDetailPage.jsx` | add push opt-in toggle |

### Acceptance Criteria
- `GET /api/push/vapid-public-key` returns the public key.
- Subscribe/unsubscribe endpoints persist/remove rows.
- One entry added → single push notification fired after ≤ 10 minutes.
- Three entries within 5-minute window → one notification with "2 weitere Artikel" text.
- Actor does not receive their own notification.
- Second push within 15-minute cooldown window for same list is suppressed.
- Push opt-in toggle only visible on shared lists.
- `npm run build` succeeds with injectManifest mode.

---

---

## Hotfix — T-007: Fix `pending_push_jobs` Migration

### Root Cause
`node-pg-migrate` rendered `items jsonb DEFAULT '[]'` as `DEFAULT ARRAY[]` in the generated SQL. PostgreSQL rejects `ARRAY[]` without a type annotation (`42P18: cannot determine type of empty array`).

### What to change
**`backend/src/db/migrations/1713920400000_add_push_tables.cjs`**

In the `pgm.createTable("pending_push_jobs", ...)` call, change the `items` column default from:
```js
default: pgm.func("ARRAY[]")   // or however it is currently expressed
```
to:
```js
default: "'[]'::jsonb"
```

The column definition should read:
```js
items: {
  type: "jsonb",
  notNull: true,
  default: "'[]'::jsonb"
}
```

### Files to change
| File | Action |
|---|---|
| `backend/src/db/migrations/1713920400000_add_push_tables.cjs` | Fix `items` column default to `'[]'::jsonb` |

### Acceptance Criteria
- `npm run migrate` runs to completion without error on a clean DB.
- Migration test suite (`npm run test --workspace backend -- src/db/migrations.test.js`) passes.

---

## Phase 6 — T-006: Fix Docker Publish Pipeline

### Root Cause
`release-please-action@v5` (v17.6.0) creates the GitHub Release and git tag **when the release PR is opened**, not when it is merged. By the time the user merges the release PR and CI triggers the release-please workflow, the release already exists → `release_created` output is never `'true'` → `docker-publish` job is permanently skipped.

### What to build

**Remove `docker-publish` job from `.github/workflows/release-please.yml`**
- Delete the entire `docker-publish` job block.
- The `outputs` block on `release-please` job can also be removed (no longer consumed by anything in this file).

**Create `.github/workflows/docker-publish.yml`**
- Trigger: `on: release: types: [published]`
  - Fires reliably whenever a GitHub Release is published, regardless of how or when it was created.
- Single job `docker-publish`:
  - `actions/checkout@v6`
  - `docker/login-action@v4` → GHCR with `${{ secrets.GITHUB_TOKEN }}`
  - `docker/metadata-action@v6` → image `ghcr.io/derfloDev/endgame-grocery`, tags:
    - `type=semver,pattern={{version}},value=${{ github.event.release.tag_name }}`
    - `type=raw,value=latest`
  - `docker/build-push-action@v7` → `push: true`
- Permissions: `contents: read`, `packages: write`

### Files to change
| File | Action |
|---|---|
| `.github/workflows/release-please.yml` | Remove `outputs` block from `release-please` job; remove entire `docker-publish` job |
| `.github/workflows/docker-publish.yml` | Create |

### Acceptance Criteria
- `.github/workflows/docker-publish.yml` exists with `on: release: types: [published]` trigger.
- `release-please.yml` no longer contains a `docker-publish` job.
- The next merged release PR automatically publishes a Docker image to GHCR without manual intervention.
- `npm run lint` passes (YAML-only change, no JS affected).

### Note on v0.4.0
The v0.4.0 GitHub Release already exists. After this fix is merged, re-publishing the v0.4.0 release via "Edit release → Save" in the GitHub UI will trigger `docker-publish.yml` and backfill the missing image.

---

## Validation (run before each commit)
```
npm run lint
npm run build
npm test
```
