# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001 — Mail + Package Infrastructure

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-04-28

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `docker-compose.yml` lines 6–13 | SMTP env-var comment block is indented inside the `postgres` service block instead of a top-level or separate comment section. The header line ("Backend mail settings are read from…") makes the intent clear, but the placement is visually confusing — a reader scanning the postgres service may not expect backend-specific documentation there. The dev compose has no backend service to attach them to, so this is the only feasible location; a brief top-level comment or moving the block above `services:` would improve clarity. | No |

No blockers. No major findings.

#### Verification

##### Steps
1. Read all changed files: `mailer.js`, `mailer.test.js`, `base.hbs`, `env.js`, `env.test.js`, `docker-compose.yml`, `docker-compose.example.yml`, `.env.example`, `backend/package.json`.
2. Cross-checked every deliverable against the T-001 plan:
   - `nodemailer` and `handlebars` added to `backend/package.json` ✅
   - `backend/src/mail/mailer.js` created with `createMailer()` factory and `send()` helper ✅
   - `backend/src/mail/templates/base.hbs` created with inline-CSS responsive table layout ✅
   - `backend/src/env.js` extended with all seven fields (`smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`, `smtpFrom`, `smtpFromName`, `appBaseUrl`) ✅
   - `docker-compose.yml` contains all seven env var names as comments ✅
   - `docker-compose.example.yml` contains all seven env vars as concrete values for the `app` service ✅
   - `.env.example` contains all seven vars with sensible defaults ✅
3. Verified acceptance criteria:
   - `getConfig()` returns all 7 new fields — confirmed in `env.js` and `env.test.js` ✅
   - `mailer.send()` contract verified via unit test with mock transport — `sendMail` called with correct `from`, `to`, `subject`, rendered HTML ✅
   - `docker-compose.yml` contains all seven env var names as comments ✅
4. Ran `npm run lint` — exits clean (one pre-existing warning in `frontend/src/context/AuthContext.jsx`, zero errors introduced by T-001) ✅
5. Ran `npm test` — 51 backend tests pass (including new `getConfig` and `createMailer` suites), 79 frontend tests pass ✅

##### Findings
- All acceptance criteria met.
- `base.hbs` correctly uses triple-brace `{{{content}}}` for the raw HTML slot and double-brace `{{body}}`/`{{intro}}` for text fields — appropriate escaping strategy for a mail template.
- `mailer.js` correctly derives `secure: true` only when port is 465, and omits `auth` entirely when both `smtpUser` and `smtpPass` are empty — suitable for unauthenticated local relays (e.g., MailHog).
- Dependency-injection pattern (`nodemailerLib`, `handlebarsLib`, `templatesDir`) makes the module fully testable without network I/O.

##### Risks
- None for T-001 scope. SMTP credentials are kept out of version control via `.env` (git-ignored); `.env.example` provides safe defaults.

#### Verdict
`PASS_WITH_NOTES`

---

## Task: T-002 — E-Mail Verification

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-04-28

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | minor | `backend/src/routes/auth.js` lines 39–68 | Register handler executes three separate DB operations (INSERT users, INSERT email_verification_tokens, send mail) outside a transaction. If the token INSERT fails after user creation, the account exists but has no verification token — the user is effectively stuck until they use resend-verification. Recovery is possible but not transparent to the user. The plan does not mandate transaction semantics here, and the pragmatic recovery path (resend-verification deletes+recreates tokens) mitigates the risk. Not blocking, but worth wrapping in a DB transaction in a follow-up. | No |

No blockers.

#### Verification

##### Steps
1. Read all changed files: `auth.js` (routes), `1713909600000_add_email_verification.cjs`, `verification.hbs`, `api/auth.js`, `AuthContext.jsx`, `RegisterPage.jsx`, `VerifyEmailPage.jsx`, `App.jsx`, `auth.test.js`, `migrations.test.js`, `app.test.jsx`.
2. Cross-checked every deliverable against the T-002 plan section:
   - Migration: `email_verified BOOLEAN NOT NULL DEFAULT true` added to `users` ✅; `email_verification_tokens` table created with all required columns and FK ✅
   - `POST /register`: inserts with `email_verified = false`, no JWT in response, sends verification mail, returns `201 { message }` ✅
   - `POST /login`: rejects `email_verified = false` with `403` ✅
   - `GET /verify-email?token=`: looks up token + expiry, sets `email_verified = true`, deletes token, returns `200 { token: JWT }`, invalid/expired → `400` ✅
   - `POST /resend-verification`: deletes old tokens, inserts new one, sends mail, always returns `200` (even for unknown email) ✅
   - `verification.hbs`: delegates to base partial with appropriate subject/context ✅
   - `api/auth.js`: `verifyEmail(token)` (GET) and `resendVerification(email)` (POST) added ✅
   - `AuthContext.jsx`: `register()` returns raw API response, no `setToken` call ✅
   - `RegisterPage.jsx`: navigates to `/verify-email` with `state: { email }` after successful register ✅
   - `VerifyEmailPage.jsx`: auto-verifies on mount when `?token=` present; shows resend form otherwise; handles cancellation on unmount ✅
   - `App.jsx`: `/verify-email` added as public route outside `ProtectedLayout` ✅
3. Verified acceptance criteria:
   - New registration sends exactly one verification e-mail and returns no JWT — confirmed by test and code ✅
   - Login with unverified account → 403 — confirmed ✅
   - Valid token → JWT issued, `email_verified = true` in DB — confirmed ✅
   - Expired/invalid token → 400 — confirmed ✅
   - Resend creates new token, deletes old ones — confirmed by test (DELETE before INSERT) ✅
   - Existing DB users remain `email_verified = true` after migration — `DEFAULT true` on column ✅
4. Ran `npm run lint` — 0 errors, 1 pre-existing warning ✅
5. Ran `npm test` — 57 backend tests pass (+6 new), 82 frontend tests pass (+3 new) ✅

##### Findings
- All acceptance criteria met.
- `addHours(now(), 24)` gives a 24-hour token expiry — reasonable default; plan doesn't specify duration.
- `buildAppUrl` gracefully handles missing `appBaseUrl` by returning just the path — useful in dev without `.env`.
- Email addresses consistently lowercased in all DB queries (`email.toLowerCase()`).
- `VerifyEmailPage` correctly guards against stale async calls via `cancelled` flag — clean React pattern.

##### Risks
- Minor strandable-user risk from non-transactional register (see finding #1). Mitigated by resend-verification recovery path.

#### Verdict
`PASS_WITH_NOTES`

---

## Task: T-003 — Password Reset

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-04-28

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `frontend/src/pages/ForgotPasswordPage.jsx` lines 21–23 | Plan says "on submit shows static success message regardless of outcome." On a network error or 500, the catch block sets `error` instead of `notice`, so the user sees a technical error message rather than the ambiguous success copy. Backend always returns 200 for this endpoint under normal operation, so the risk only surfaces on network/server faults. Showing the static success notice unconditionally would better match the security intent. | No |

No blockers.

#### Verification

##### Steps
1. Read all changed files: migration `1713913200000_add_password_reset_tokens.cjs`, `password-reset.hbs`, `auth.js` (routes), `api/auth.js`, `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`, `LoginPage.jsx`, `App.jsx`, `auth.test.js` (new tests), `migrations.test.js` (new test), `app.test.jsx` (new tests).
2. Cross-checked every deliverable against the T-003 plan section:
   - Migration: `password_reset_tokens` table with all required columns (`id`, `user_id` FK CASCADE, `token UNIQUE`, `expires_at`, `used BOOLEAN DEFAULT false`, `created_at`) ✅
   - `POST /forgot-password`: only acts for `email_verified = true` users; `expires_at = NOW() + 1h`; always returns `200 { message }` ✅
   - `POST /reset-password`: validates token (exists, not expired, `used = false`); hashes new password; marks token `used = true`; returns `200 { message }`; invalid/used/expired → `400` ✅
   - `password-reset.hbs`: delegates to base partial with German subject + 60-min warning body ✅
   - `forgotPassword(email)` and `resetPassword(token, password)` in `api/auth.js` ✅
   - `ForgotPasswordPage`: email form, shows success notice on submit ✅
   - `ResetPasswordPage`: reads `?token`, password form, navigates to `/login` with success message on completion ✅
   - `LoginPage`: "Forgot password?" link to `/forgot-password` added ✅; now also renders `location.state?.message` as a success banner (T-003 + prep for future flows) ✅
   - `App.jsx`: `/forgot-password` and `/reset-password` added as public routes ✅
3. Verified acceptance criteria:
   - Unknown email → `200`, no mail sent — confirmed by test and `if (user?.email_verified)` guard ✅
   - Reset link expires after 60 min → `400` — confirmed (`addHours(now(), 1)`, SQL `expires_at > $2`) ✅
   - Used token rejected with `400` — confirmed (SQL `used = false`, then `SET used = true`) ✅
   - Successful reset allows login with new password — confirmed (bcrypt hash written to `users.password_hash`) ✅
4. Ran `npm run lint` — 0 errors, 1 pre-existing warning ✅
5. Ran `npm test` — 62 backend tests pass (+5 new: 4 auth + 1 migration), 85 frontend tests pass (+3 new) ✅

##### Findings
- Token expiry is 1 hour (`addHours(now(), 1)`) — matches plan's "60 min".
- `forgot-password` correctly skips unverified accounts — prevents reset-before-verify bypass.
- `LoginPage` now handles `location.state?.from` for post-login redirect — bonus prep for T-004 invite flow, no regression risk.
- `ResetPasswordPage` shows an immediate error when no `?token` in URL — good defensive UX.
- Used tokens remain in the table (not deleted) — safe and auditable.

##### Risks
- None for T-003 scope.

#### Verdict
`PASS_WITH_NOTES`

---

## Task: T-004 — List Sharing via Invitation

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-28

#### Findings

No findings. Implementation is clean and complete.

#### Verification

##### Steps
1. Read all changed files: migration `1713916800000_add_list_invites.cjs`, `inviteService.js`, `routes/invites.js`, `routes/sharing.js`, `routes/auth.js` (register extension), `app.js`, `invite-existing.hbs`, `invite-new.hbs`, `revocation.hbs`, `InviteAcceptPage.jsx`, `RegisterPage.jsx`, `LoginPage.jsx`, `ShareListSheet.jsx`, `ListDetailPage.jsx` (`handleShareSubmit`), `api/sharing.js`, `App.jsx`, all test files.
2. Cross-checked every deliverable against the T-004 plan section:
   - Migration: `list_invites` table with all required columns, `status IN (...)` CHECK constraint, unique partial index `(list_id, invited_email) WHERE status='pending'` ✅
   - `POST /members`: upserts invite row (ON CONFLICT resets token), sends `invite-existing.hbs` or `invite-new.hbs` based on whether user exists, returns `201 { invite }` ✅
   - `DELETE /:uid`: sends `revocation.hbs` after member removal ✅
   - `GET /api/invites/:token` (`requireAuth`): looks up pending+unexpired invite, idempotently adds to `list_members` (ON CONFLICT DO NOTHING), marks `accepted`, returns `{ listId }` ✅
   - `inviteService.js`: shared `getPendingInviteByToken` and `acceptInviteForUser` extracted correctly; used by both `auth.js` and `invites.js` ✅
   - `POST /register` with `invite_token`: validates token, checks email match via `isInviteEmailMatch`, inserts user with `email_verified=true`, consumes invite, returns JWT+listId ✅; falls back to normal verify flow if invite invalid ✅
   - `app.js`: invites router registered at `/api/invites` ✅
   - All three mail templates delegate to base partial ✅
   - `InviteAcceptPage`: redirects to `/login?redirect=...` when unauthenticated; calls `acceptInvite` on mount when authenticated; unmount cleanup via `cancelled` flag ✅
   - `LoginPage`: reads `searchParams.get("redirect")` with `location.state?.from` as fallback ✅
   - `RegisterPage`: reads `?invite=` param, passes `invite_token`, navigates to list on JWT+listId response ✅
   - `App.jsx`: `/invite/:token` added as public route ✅
   - `ListDetailPage.handleShareSubmit`: shows "Invitation sent to [email]" notice from `result.invite.invited_email` ✅
3. Verified all T-004 acceptance criteria:
   - `POST /members` no longer adds member directly; creates invite + sends mail ✅
   - Existing user clicks invite link → added to list, redirected ✅
   - New user registers via `?invite=` → `email_verified=true`, JWT, redirected to list ✅
   - Invite expires after 7 days (`addDays(now(), 7)`) ✅
   - Duplicate invite resets token and resends via ON CONFLICT upsert ✅
   - Revoked member receives revocation mail ✅
   - ShareListSheet shows "invitation sent" notice ✅
4. Ran `npm run lint` — 0 errors, 1 pre-existing warning ✅
5. Ran `npm test` — 69 backend tests pass (+7 new: 2 auth + 3 invites + 1 sharing + 1 migration), 87 frontend tests pass (+2 new) ✅

##### Findings
- `isInviteEmailMatch` securely validates that the registering email matches `invite.invited_email` — prevents invite token hijacking.
- `acceptInviteForUser` is idempotent (`ON CONFLICT DO NOTHING` for `list_members` insert), correctly handles already-a-member case.
- Shared `inviteService.js` cleanly eliminates duplication between `auth.js` and `invites.js`; both use injected `pool`, so tests can mock via the pool stub.
- `LoginPage` now reads both `?redirect=` query param and `location.state.from` — correct priority order for the invite-accept redirect flow.

##### Risks
- None for T-004 scope.

#### Verdict
`PASS`

---

## Task: T-005 — Push Notifications

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-04-28

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `backend/src/app.js` line 38 | `startPushWorker` returns a `clearInterval` cleanup function but `app.js` does not store or call it. There is no graceful shutdown path for the push worker timer. This is mitigated by `timer.unref()` in `startPushWorker` (process can exit without the timer blocking it), so there is no operational risk. | No |
| 2 | nit | `backend/src/workers/pushWorker.js` lines 86–90 | `webpushLib.setVapidDetails(...)` is called inside `processPendingPushJobs`, which runs on every 5-second tick. The VAPID values are static at startup and could be set once. No functional impact — the `web-push` library stores values in memory. | No |

No blockers. No major findings.

#### Verification

##### Steps
1. Read all changed files: migration `1713920400000_add_push_tables.cjs`, `env.js`, `app.js`, `routes/push.js`, `workers/pushWorker.js`, `routes/entries.js` (enqueue call), `api/push.js`, `hooks/usePushNotifications.js`, `sw/service-worker.js`, `vite.config.js`, `pages/ListDetailPage.jsx`, `push.test.js`, `pushWorker.test.js`, `env.test.js`, `migrations.test.js`, `.env.example`, `docker-compose.yml`, `docker-compose.example.yml`.
2. Cross-checked every deliverable against the T-005 plan section:
   - Migration: `push_subscriptions` (with `(user_id, endpoint)` unique constraint), `pending_push_jobs` (with `(list_id, actor_user_id)` unique constraint), `push_cooldowns` (PK on `list_id`) ✅
   - `GET /api/push/vapid-public-key` — no auth required, returns `{ publicKey }` ✅
   - `POST /api/push/subscribe` — upserts subscription row ✅
   - `DELETE /api/push/subscribe` — removes subscription row ✅
   - `enqueuePushJob`: creates new job or appends items/resets fire_at on existing within-window job; fire_at = NOW + 5 min ✅
   - `startPushWorker`: setInterval every 5s, `timer.unref()` for clean process exit ✅
   - `processPendingPushJobs`: fetches due jobs, checks 15-min cooldown, excludes actor from recipients, sends Web Push, swallows 410 Gone (removes stale sub), deletes job, upserts cooldown ✅
   - `entries.js` POST: fires `enqueuePushJob` fire-and-forget after successful insert ✅
   - `app.js`: push router registered, worker started only when `pool` not explicitly passed (DI-based test guard) ✅
   - `getConfig()`: `vapidPublicKey`, `vapidPrivateKey`, `vapidContact` added ✅
   - `docker-compose.yml`/`.env.example`/`docker-compose.example.yml`: all 3 VAPID vars documented ✅
   - `vite.config.js`: switched to `strategies: "injectManifest"`, `srcDir: "src/sw"`, `injectManifest.globPatterns` ✅
   - `service-worker.js`: `precacheAndRoute`, `push` event handler with `showNotification`, `notificationclick` handler with focus/open ✅
   - `usePushNotifications`: fetches VAPID key + SW subscription on mount; `subscribe()` requests permission, creates PushSubscription, calls API; `unsubscribe()` calls browser + API ✅
   - `ListDetailPage`: `shouldShowPushToggle = Boolean(list) && (!list.is_owner || members.length > 1)` — shows for non-owners (always shared) and owners with ≥1 other member; toggle button conditionally renders ✅
3. Verified all T-005 acceptance criteria:
   - Subscribe/unsubscribe endpoints persist/remove rows — confirmed by tests ✅
   - Single entry → push within ≤10 min — `fire_at = NOW + 5min`, worker polls every 5s ✅
   - 3 entries in 5-min window → one batched notification — `items.length - 1} weitere Artikel` body; test confirms "Milk und 2 weitere Artikel" ✅
   - Actor excluded — SQL `recipient.user_id <> $2`; test asserts query shape ✅
   - 15-min cooldown suppresses second notification — `last_sent_at > NOW - 15min` check; test confirms no send ✅
   - Toggle only on shared lists — condition correctly gates on shared-list context ✅
   - `npm run build` passes — `injectManifest` builds `service-worker.js`, 12 precache entries ✅
4. Ran `npm run lint` — 0 errors, 1 pre-existing warning ✅
5. Ran `npm test` — 76 backend tests pass (+7 new: 3 push route + 3 push worker + 1 migration + updated entries), 93 frontend tests pass (+6 new) ✅
6. Ran `npm run build` — PWA injectManifest build succeeds, `dist/service-worker.js` generated ✅

##### Findings
- `timer.unref()` in `startPushWorker` ensures the push worker timer does not prevent Node.js process exit — correct approach for a background interval worker.
- Worker startup guard `options.startWorkers ?? !("pool" in options)` is an elegant DI-based test isolation pattern that avoids `process.env.NODE_ENV` checks.
- `enqueuePushJob` correctly resets the 5-min window on each new entry (extends `fire_at`) — enables batching without a separate scheduler.
- `decodeBase64Url` in `usePushNotifications.js` correctly pads and decodes the VAPID public key for `applicationServerKey`.

##### Risks
- Push worker runs globally for the process and is not scoped per-list — acceptable for this scale.
- VAPID keys must be generated and configured before push notifications function; left blank in `.env.example` by design.

#### Verdict
`PASS_WITH_NOTES`

---

## Task: T-006 — Fix Docker Publish Pipeline

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-28

#### Findings

No findings. Implementation matches the plan exactly.

#### Verification

##### Steps
1. Confirmed `.github/workflows/docker-publish.yml` exists with `on: release: types: [published]` trigger.
2. Confirmed `.github/workflows/release-please.yml` no longer contains a `docker-publish` job or `outputs` block — the file now contains only the `release-please` job with a single `release-please-action@v5` step.
3. Cross-checked every deliverable against the T-006 plan:
   - `docker-publish.yml` trigger: `on: release: types: [published]` ✅
   - Job named `docker-publish` ✅
   - `actions/checkout@v6` (consistent with project-wide standard in `ci.yml`) ✅
   - `docker/login-action@v4` → GHCR with `${{ secrets.GITHUB_TOKEN }}` ✅
   - `docker/metadata-action@v6` → `images: ghcr.io/derfloDev/endgame-grocery` ✅
   - `type=semver,pattern={{version}},value=${{ github.event.release.tag_name }}` ✅
   - `type=raw,value=latest` ✅
   - `docker/build-push-action@v7` with `push: true` ✅
   - Permissions: `contents: read`, `packages: write` ✅
   - `release-please.yml` `outputs` block removed ✅
   - `release-please.yml` `docker-publish` job removed ✅
4. Ran `npm run test --workspace backend -- src/releaseWorkflow.test.js` — 2/2 pass ✅
5. Ran `npm run lint` — 0 errors, 1 pre-existing warning ✅
6. Ran `npm run build` — passes (pre-existing `onnxruntime-web` eval warning only) ✅
7. Ran `npm test` — 78 backend tests pass (+2 new release workflow tests), 93 frontend tests pass ✅

##### Findings
- `releaseWorkflow.test.js` correctly validates both the absence of `docker-publish` in `release-please.yml` and the full shape of `docker-publish.yml` via file-system assertions — no mocking required for YAML contract tests.
- Action version pinning (`actions/checkout@v6`, `docker/*@v4/v6/v7`) matches the project standard established in `ci.yml` — no deviation.

##### Risks
- None. YAML-only change; no runtime code affected.

#### Verdict
`PASS`
