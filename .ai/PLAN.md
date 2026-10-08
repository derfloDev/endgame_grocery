# Plan

Status: **ready**

Revision 1 — 2026-10-08. Goal: implement the scope defined in `ROADMAP.md` — fix every verified
finding of the 2026-10-08 full-codebase review. The four user decisions and the planner decisions
listed in `ROADMAP.md` are binding for this plan.

## Scope

24 tasks in five blocks. Tasks run in board order; dependencies are listed per task.

| Block | Tasks |
| --- | --- |
| Security | T-001 startup safety, T-002 integration-test harness, T-003 push pipeline, T-004 credential-free logs and SSE tickets, T-005 abuse protection and hardening, T-006 session revocation, T-007 hashed credentials, T-008 invite binding |
| Correctness and integrity | T-009 transactions and input validation, T-010 shared entry service, T-012 membership lifecycle events, T-014 offline queue, T-015 icon editing |
| Performance | T-011 indexes and list endpoint, T-013 SSE patching, T-016 cache-first loading, T-017 render and bundle, T-018 precomputed embeddings, T-019 nginx caching |
| Maintainability | T-020 error codes, T-021 types, T-022 hook split |
| Tests | T-023 coverage gaps, T-024 route-based fetch fake |

T-002 lands second so every later backend task can add real-PostgreSQL regression tests.
T-003 is placed right after it because push is broken in production and its fix needs those tests.

## Cross-cutting rules for the implementer

- Test first: for each changed behaviour write the failing unit/integration test, then the code.
- Backend SQL changes get at least one integration test in `backend/src/integration/` (T-002).
  Locally these tests skip when `TEST_DATABASE_URL` is unset (PostgreSQL is not available in the
  usual dev environment); CI always runs them.
- New user-visible strings get DE and EN entries in `frontend/src/locales/*/translation.json`.
- New env variables go into `.env.example`, `docker-compose.example.yml` (where relevant) and the
  README "Environment variables" table in the same task.
- Every migration has a working `down`; irreversible data transforms (hashing) document in a
  comment what `down` cannot restore.
- Do not change behaviour outside the task; note discoveries in the HANDOFF entry instead.

## Acceptance Criteria

The acceptance criteria per task are in `.ai/TASKS.md`; the roadmap-level criteria are in
`ROADMAP.md`. In addition, for every task: `npm run lint`, `npm run build`, `npm test` pass, and
the integration suite passes in CI.

## Implementation Phases

### T-001 — Production-safe startup configuration

Files: `backend/src/app.js`, `backend/src/env.js`, `backend/src/index.js`,
`backend/src/middleware/auth.js`, `backend/src/routes/auth.js` (sign options),
`backend/src/routes/events.js` (verify path), `Dockerfile`, `playwright.config.js`,
`.github/workflows/ci.yml`, `.env.example`, `docker-compose.example.yml`, `README.md`
(env table, E2E section), tests `app.test.js`, `env.test.js`, `auth.test.js`, `index.test.js`.

1. `getConfig()` gains `enableTestRoutes: process.env.ENABLE_TEST_ROUTES === "true"`. `app.js`
   mounts `/api/test` only when it is true; the `NODE_ENV` check is removed.
2. `Dockerfile` runtime stage sets `ENV NODE_ENV=production`.
3. `playwright.config.js` passes `ENABLE_TEST_ROUTES=true` in the backend `webServer.env`; the CI
   E2E `.env` gets it too.
4. New `validateConfig(config)` in `env.js` returns a list of problems: missing `DATABASE_URL`,
   `JWT_SECRET` empty, shorter than 32 characters or containing `change-me`. `startServer` in
   `index.js` logs the problems and exits with code 1. `createApp` (used by tests) does not
   validate.
5. `jwt.sign` uses `{ algorithm: "HS256" }`; every `jwt.verify` passes `{ algorithms: ["HS256"] }`.
6. CI and `.env.example` get a ≥ 32-character secret; `.env.example` and the compose example
   explain how to generate one (`openssl rand -base64 48`) and no longer contain `change-me` for
   `JWT_SECRET`.
Tests first: test routes absent without the flag and present with it; `validateConfig` cases;
`alg:none`, wrong-secret and expired tokens return 401 on `/api/auth/me` and a list route.

### T-002 — PostgreSQL integration-test harness and migration round-trip

Files: new `backend/src/integration/helpers.js`, new `backend/src/integration/*.test.js`,
`backend/package.json` (script `test:integration`), root `package.json` if it aggregates tests,
`.github/workflows/ci.yml`, `README.md` (Validation + CI/CD sections).

1. `helpers.js`: when `TEST_DATABASE_URL` is unset, export a `describeDb` that skips with a clear
   reason. Otherwise create a uniquely named schema per test file, run all migrations
   programmatically through node-pg-migrate into it, expose a real `pg.Pool` with `search_path`
   set, and drop the schema afterwards.
2. Seed helpers: `createUser`, `createList`, `addMember`, `createEntry`, `createInvite`.
3. First integration tests (they codify current behaviour so later tasks change them knowingly):
   `ensureListAccess` for owner, member and stranger; entries GET for a stranger returns 403
   through `createApp({ pool })`.
4. Migration round-trip test: up to latest, down to 0, up again; compare
   `information_schema.columns` plus `pg_indexes` snapshots before and after.
5. CI: add a `postgres:16` service to the `unit-test` job, export
   `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/endgame_grocery_test` (create the
   database in a step) and run the integration script after `npm test`.

### T-003 — Working, idempotent push pipeline

Depends on T-002. Files: `backend/src/workers/pushWorker.js`, `backend/src/routes/push.js`,
`backend/src/app.js` (worker start), tests `pushWorker.test.js`, `push.test.js`, new
`integration/push.test.js`, `README.md` (push feature bullet, single-instance note in Docker
section).

1. Enqueue becomes one statement:
   `INSERT INTO pending_push_jobs (list_id, actor_user_id, fire_at, items) VALUES ($1,$2,$3,$4::jsonb)
   ON CONFLICT (list_id, actor_user_id) DO UPDATE SET items = CASE WHEN pending_push_jobs.fire_at > $5
   THEN pending_push_jobs.items || EXCLUDED.items ELSE EXCLUDED.items END, fire_at = EXCLUDED.fire_at
   RETURNING jsonb_array_length(items)` with `JSON.stringify([entryText])`.
2. The worker claims due jobs atomically:
   `DELETE FROM pending_push_jobs WHERE id IN (SELECT id FROM pending_push_jobs WHERE fire_at <= $1
   ORDER BY fire_at FOR UPDATE SKIP LOCKED LIMIT 50) RETURNING *`. Items appended after the claim
   create a new row and are not lost.
3. Per subscription: 404 and 410 delete the subscription; any other error is logged with the
   truncated endpoint and the loop continues. The cooldown upsert always runs after a job.
4. `startPushWorker` uses a `setTimeout` chain (next tick scheduled after the current one
   settles), so ticks never overlap; the stop function cancels the pending timer.
5. `POST /api/push/subscribe` validates the endpoint: `https:` only, no IP literal, hostname must
   end with one of `fcm.googleapis.com`, `push.services.mozilla.com`, `notify.windows.com`,
   `push.apple.com`, `web.push.apple.com`; otherwise 400.
6. README: push now documented as single-instance (in-process worker and SSE fan-out).
Tests first: integration test that two concurrent enqueues produce one row with two items;
worker unit tests for 404 deletion, a 500 on one subscription still delivering to the others and
completing the job, and non-overlapping ticks with fake timers; subscribe rejects
`https://10.0.0.1/x` and `http://fcm.googleapis.com/x`.

### T-004 — Credential-free logs and ticket-based SSE authentication

Files: `backend/src/logger.js`, `backend/src/app.js`, `backend/src/routes/events.js`, new
`backend/src/sseTickets.js`, `frontend/src/context/EventSourceContext.tsx`, new
`frontend/src/api/events.ts`, `docker/nginx.conf` (log format), tests `events.test.js`, new
`sseTickets.test.js`, `app.test.js`, `EventSourceContext.test.tsx`, `README.md` (all
`GET /api/events?token=<jwt>` mentions), code comments in `EventSourceContext.tsx`.

1. `logger.js`: `redact: { paths: ["req.headers.authorization", "req.headers[\"x-api-key\"]",
   "req.headers.cookie"], censor: "[redacted]" }`.
2. pino-http `serializers.req` logs `method`, `url` with the query string removed and the path
   segment after `/api/invites/` replaced by `:token`, plus `remoteAddress`.
3. `sseTickets.js`: in-memory map `ticket -> { userId, expiresAt }`; `issue(userId)` returns
   `randomBytes(32).toString("base64url")` valid 30 s; `consume(ticket)` deletes and returns the
   user id if unexpired; expired tickets are swept on each issue.
4. `POST /api/events/ticket` (Bearer auth) returns `{ ticket }`. `GET /api/events` accepts
   `?ticket=` (consumed) or an `Authorization` header; `?token=` support is removed.
5. Frontend: before each `new EventSource`, `EventSourceContext` fetches a ticket; a failed ticket
   request counts as a failed connection attempt and goes through the existing backoff. A 401 on
   the ticket request dispatches `auth:expired`.
6. nginx: `log_format main_noquery '$remote_addr - $remote_user [$time_local] "$request_method $uri
   $server_protocol" $status $body_bytes_sent "$http_referer" "$http_user_agent"';` and
   `access_log /dev/stdout main_noquery;`.
Tests first: a captured log line of an authenticated request with `X-Api-Key` and `?token=x`
contains neither value; ticket single use and expiry; `?token=<jwt>` now returns 401; frontend
connects with `?ticket=` and retries when the ticket request fails.

### T-005 — Abuse protection and hardening

Files: `backend/package.json` (+ `express-rate-limit`), new `backend/src/middleware/rateLimit.js`,
`backend/src/app.js`, `backend/src/routes/auth.js`, `backend/src/routes/sharing.js`,
`docker/nginx.conf`, `docker/supervisord.conf`, `.github/workflows/*.yml`,
`frontend/src/pages/RegisterPage/RegisterPage.tsx`, `ResetPasswordPage.tsx`, `LoginPage.tsx`,
locales, tests `auth.test.js`, `sharing.test.js`, new `rateLimit.test.js`, page tests,
`README.md` (security/deployment notes, password rules, CSP host list).

1. `app.set("trust proxy", 1)` and `app.disable("x-powered-by")`.
2. Rate limits (in-memory store, single instance): login 5 per 15 min keyed per IP and separately
   per normalised email; register, forgot-password, resend-verification 5 per hour per IP and per
   email; reset-password 10 per hour per IP; invite POST 20 per hour per user. 429 body
   `{ error }` with `Retry-After`. Limits are injectable for tests.
3. Login: when the user does not exist, compare against a constant dummy bcrypt hash so timing
   matches.
4. Password policy for register and reset: string, ≥ 8 characters, ≤ 72 UTF-8 bytes; 400
   otherwise. The frontend validates the same rule before submitting and shows a translated hint.
5. `LoginPage`: `redirect`/`from` is only followed when it starts with a single `/` (not `//`,
   not `/\`); otherwise `/`.
6. nginx security headers at server level with `always`: `Content-Security-Policy` (see below),
   `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
   `Permissions-Policy: camera=(), microphone=(), geolocation=()`. CSP:
   `default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net;
   worker-src 'self' blob:; connect-src 'self' https://huggingface.co https://*.hf.co
   https://cdn.jsdelivr.net; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline';
   font-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';
   form-action 'self'`. The implementer must load the production build through nginx (or apply the
   same header in `vite preview`) and confirm zero CSP violations for login, list detail, icon
   model download and push opt-in; adjust hosts only with evidence and record them in the README.
   The Swagger UI path `/api/docs/` is proxied to Express; if its inline assets violate the CSP,
   override the header for `location /api/docs/` only.
7. `supervisord.conf`: `user=node` for `[program:backend]`.
8. Workflows: top-level `permissions: contents: read` (jobs that need more keep their explicit
   block); pin third-party actions to full commit SHAs with the tag as a comment.
Tests first: 6th login returns 429; dummy-hash path calls `bcrypt.compare`; short and > 72-byte
passwords return 400; `redirect=//evil.example` and `redirect=https://evil.example` land on `/`.

### T-006 — Session revocation and atomic password reset

Depends on T-002. Files: new migration `*_add_token_version_to_users.cjs`,
`backend/src/middleware/auth.js`, `backend/src/routes/auth.js`, `backend/src/routes/events.js`,
`backend/src/app.js` (pool into auth middleware), tests `auth.test.js`, new
`integration/auth.test.js`, `frontend/src/locales/*` (reset success text),
`README.md` (auth bullet).

1. `users.token_version integer NOT NULL DEFAULT 0`. JWTs carry `tv`.
2. `requireAuth` becomes async: verify the JWT, then `SELECT token_version FROM users WHERE id=$1`
   (primary key lookup); a mismatch or missing user returns 401 "Authentication token is invalid."
   The ticket issue endpoint (T-004) uses the same check.
3. Reset consumes the token in one statement:
   `UPDATE password_reset_tokens SET used = true WHERE token = $1 AND used = false AND
   expires_at > $2 RETURNING user_id`. In the same transaction: update the hash, increment
   `token_version`, delete the user's other reset tokens, clear the API key (planner decision).
4. Reset success text (DE/EN) states that other devices are signed out and the Home Assistant key
   must be regenerated.
Tests first: integration — old JWT returns 401 after reset; two concurrent resets with the same
token: exactly one succeeds; a second reset token issued earlier is unusable afterwards.

### T-007 — Hashed API keys and one-time tokens; API key shown once

Depends on T-006. Files: new migration `*_hash_credentials.cjs`, new `backend/src/tokens.js`
(`hashToken`, `generateToken`), `backend/src/middleware/auth.js`, `backend/src/routes/auth.js`,
`backend/src/routes/sharing.js`, `backend/src/inviteService.js`, `backend/src/routes/testRouter.js`,
`frontend/src/api/auth.ts`, `frontend/src/components/InfoSheet/InfoSheet.tsx` (+ CSS),
locales, tests `auth.test.js`, `sharing.test.js`, `invites.test.js`, `InfoSheet.test.tsx`, new
`integration/credentials.test.js`, `README.md` (API key bullet), `backend/src/openapi/v1.yaml`
(security scheme description).

1. Migration: `users.api_key_hash text UNIQUE`, `users.api_key_hint text`,
   `users.api_key_created_at timestamptz`; populate from existing keys with
   `encode(sha256(api_key::text::bytea), 'hex')` and the last 4 characters; drop `api_key`.
   `email_verification_tokens`, `password_reset_tokens`, `list_invites`: add `token_hash text`,
   populate the same way, make it NOT NULL UNIQUE, drop `token`. `down` re-adds the plaintext
   columns empty and documents that hashed values cannot be restored.
2. All lookups hash the presented value with SHA-256 hex and compare by equality. Generation
   stays `randomUUID()`; the plaintext only exists in the response or mail.
3. `GET /api/auth/api-key` returns `{ has_key, hint, created_at }`; `POST` returns
   `{ api_key, hint, created_at }` once.
4. InfoSheet: without a key — "Generate"; after generation — the full key with copy button and a
   translated "shown only once" warning; later — `•••• <hint>` with "Regenerate" (confirm dialog).
Tests first: integration — an API key created before the migration still authenticates after it;
no column in the schema stores the plaintext; GET never returns the key; InfoSheet flows.

### T-008 — Invites bound to the invited email

Depends on T-007. Files: `backend/src/routes/invites.js`, `backend/src/inviteService.js`,
`backend/src/routes/auth.js` (register-with-invite path), `frontend/src/pages/InviteAcceptPage/*`,
locales, tests `invites.test.js`, `auth.test.js`, new `integration/invites.test.js`, new
`InviteAcceptPage.test.tsx`, `README.md` (sharing bullet).

1. Acceptance loads the user's email; if it differs from `invited_email` (case-insensitive) return
   403 `{ error: "This invitation was sent to a different email address." }`.
2. If the user owns the list, return 409 and leave the invite pending.
3. Acceptance runs in a transaction: `UPDATE list_invites SET status='accepted', accepted_at=now()
   WHERE token_hash=$1 AND status='pending' AND expires_at > $2 RETURNING list_id`, then
   `INSERT INTO list_members ... ON CONFLICT DO NOTHING`.
4. InviteAcceptPage shows translated messages for 403 (with the signed-in email and a sign-out
   action) and 409.
Tests first: different email → 403 and no membership; owner → 409; the same token accepted twice
→ second answers 400; register with a valid invite for another email → not auto-verified.

### T-009 — Transactions, limits and input validation

Depends on T-002. Files: `backend/src/db/client.js` (`withTransaction`), new
`backend/src/middleware/validateUuid.js`, `backend/src/app.js` (error handler, `router.param`),
`backend/src/routes/entries.js`, `backend/src/routes/auth.js` (register),
`backend/src/routes/sharing.js`, `backend/src/routes/lists.js`, `backend/src/mail/mailer.js`
(fire-and-forget helper), `backend/src/middleware/auth.js` (API-key format), tests
`entries.test.js`, `sharing.test.js`, `lists.test.js`, `auth.test.js`, new
`integration/entries.test.js`, `README.md` (limits bullet, mail-failure behaviour).

1. `withTransaction(pool, fn)` with `BEGIN`/`COMMIT`/`ROLLBACK` on a dedicated client.
2. Entry create: in a transaction, `SELECT 1 FROM lists WHERE id=$1 FOR UPDATE`, count open
   entries, insert. Status change to done: in a transaction lock the list row, `SELECT status FROM
   entries WHERE id=$1 AND list_id=$2 FOR UPDATE`; 404 if missing; evict the oldest done entry only
   if the target is currently open and the cap is reached, excluding the target id.
3. UUID path parameters (`:id`, `:entryId`, `:uid`, `:listId`, `:itemId`) are validated with
   `router.param`; invalid → 404 with the existing "not found" message of the route. Invite tokens
   and API keys with a non-UUID shape are rejected before any query (400 / 401).
4. Error handler maps pg `22P02` → 400, `23505` → 409, `23503` → 404; everything else 500.
5. Mail sending after a committed change (invite, revoke, leave, register verification,
   resend) runs after the response through `sendMailInBackground(fn, logger)`; failures are logged.
   Register's inserts (user, verification token, optional membership) share one transaction.
Tests first: PATCH done for an unknown id with 200 done entries deletes nothing (integration);
concurrent creates cannot exceed 1,000 open entries (integration); malformed ids give 404;
an SMTP failure on revoke still returns 204.

### T-010 — Shared entry service for the app API and v1

Depends on T-009. Files: new `backend/src/services/entryService.js`, `backend/src/routes/entries.js`,
`backend/src/routes/v1.js`, `backend/src/openapi/v1.yaml`, tests `entries.test.js`, `v1.test.js`,
new `integration/entryService.test.js`, `README.md` (v1 bullet).

1. `entryService` exposes `createEntry`, `updateEntry`, `deleteEntry`, `listEntries`, each taking
   `{ pool, sseManager, logger, userId, listId, ... }`; it owns access checks, limits (T-009),
   `last_updated_by`, SSE broadcasts and push enqueue.
2. `entries.js` and `v1.js` only parse input and serialise output (v1 keeps `serializeItem`).
   v1 `description` handling matches the app API (whitespace → null; non-string → 400).
3. OpenAPI: remove the autocomplete-history sentence (`v1.yaml:100`), replace `nullable: true`
   with `type: [string, "null"]`, document 422 for the open-entry cap.
Tests first: v1 create sets `last_updated_by`, returns 422 at the cap and enqueues a push; v1
toggle and rename set `last_updated_by`.

### T-011 — Indexes, pool settings and a single-list endpoint

Depends on T-002. Files: new migration `*_add_query_indexes.cjs`, `backend/src/db/client.js`,
`backend/src/routes/lists.js`, `frontend/src/api/lists.ts`, tests `lists.test.js`,
`integration/indexes.test.js`, `README.md` (API overview).

1. Migration: `CREATE EXTENSION IF NOT EXISTS pg_trgm`; indexes `entries(list_id, status,
   created_at)`, `entries(list_id, updated_at)`, `lists(owner_id)`, `list_members(user_id)`,
   `pending_push_jobs(fire_at)`, `push_subscriptions(endpoint)` if not already unique, and a GIN
   `gin_trgm_ops` index on `entries(text)`. `down` drops the indexes but not the extension.
2. Pool: `max` from `PG_POOL_MAX` (default 10), `connectionTimeoutMillis: 5000`,
   `idleTimeoutMillis: 30000`; document `PG_POOL_MAX`.
3. `GET /api/lists/:id` returns `{ list: { id, name, owner_id, owner_name, is_owner, created_at } }`
   with access check; `fetchList(token, id, { onCachedValue })` in the frontend with cache key
   `list:<id>` (used by T-016).
Tests first: integration — `EXPLAIN (FORMAT JSON)` of the entries query on a seeded list contains
no `Seq Scan` on `entries`; the new endpoint returns 403 for strangers.

### T-012 — Membership and list lifecycle events reach everyone affected

Files: `backend/src/routes/sharing.js`, `backend/src/routes/lists.js`, `backend/src/sseManager.js`,
`frontend/src/pages/ListDetailPage/ListDetailPage.tsx`, `frontend/src/pages/OverviewPage/OverviewPage.tsx`,
locales, tests `sharing.test.js`, `lists.test.js`, `sseManager.test.js`, `ListDetailPage.test.tsx`,
`OverviewPage.test.tsx`, `README.md` (SSE bullet).

1. Member removal and leave: after the delete, broadcast to the remaining recipients and call
   `sseManager.sendToUsers([removedUserId], "member:removed", ...)` directly.
2. List delete: read the recipients first, delete, then send `list:deleted` to the captured users
   without awaiting; a broadcast failure never blocks the delete.
3. Detail page: on `list:deleted`, or `member:removed` for the current user, navigate to `/` and
   show a translated notice; on `list:updated`, update the title in place.
4. Overview: `member:removed` for the current user removes that list.
Tests first: the removed user receives `member:removed` with the real `SseManager`; the detail
page navigates away on both events; delete succeeds when the broadcast rejects.

### T-013 — Live entry updates patched from the event payload (Decision 3)

Depends on T-010, T-012. Files: `backend/src/services/entryService.js`, `backend/src/sseManager.js`,
`frontend/src/pages/ListDetailPage/ListDetailPage.tsx`, `useListDetailData.ts`,
`listDetailUtils.ts`, `frontend/src/context/EventSourceContext.tsx` (payload types), tests
`entries.test.js`, `v1.test.js`, `ListDetailPage.test.tsx`, `listDetailUtils` tests,
`README.md` (SSE bullet: payloads and refetch rules).

1. `entry:created`/`entry:updated` payload: `{ listId, entryId, actorId, entry }` with the same
   fields as the entries GET (without `is_changed`); `entry:deleted`: `{ listId, entryId, actorId,
   entryStatus }`. Existing fields stay for compatibility.
2. Client: `applyEntryEvent(entries, event, currentUserId)` upserts or removes by id, idempotently;
   `is_changed` is `entry.last_updated_by !== currentUserId`; pending local entries and locally
   done badges are preserved exactly as in `mergePendingEntries`. Own events are applied too
   (another tab or device of the same user needs them; the upsert is a no-op for this tab).
3. Recently-used history reloads only when an event moves an entry to or from `done`, or deletes
   a done entry, debounced 250 ms.
4. Resync and `syncVersion` keep the full refetch.
Tests first: toggling on one client issues no `/entries` GET on the others; a create event for an
entry that already exists is a no-op; history reload debounces 3 events into 1 request.

### T-014 — Offline queue correctness and per-user scoping

Depends on T-009 (validation) and T-013 (entry state). Files: `frontend/src/api/offlineQueueDrain.ts`,
`frontend/src/api/offlineStore.ts`, `frontend/src/api/client.ts`, `frontend/src/api/entries.ts`,
`frontend/src/api/lists.ts`, `frontend/src/context/OfflineQueueContext.tsx`,
`frontend/src/context/AuthContext.tsx`, `useListDetailData.ts`, `listDetailUtils.ts`,
`frontend/src/context/EventSourceContext.tsx` (resync reset), `frontend/src/types.ts`, locales,
tests `OfflineQueueContext.test.tsx`, new `offlineQueueDrain.test.ts`, `offlineStore.test.ts`,
`ListDetailPage.test.tsx`, `AuthContext.test.tsx`, e2e `queue-retry.spec.js`, `README.md`
(offline bullets).

1. The drain sends the current token (read through a getter passed by `OfflineQueueContext`), not
   `mutation.token`; `token` is no longer stored on new mutations.
2. A 401 pauses the queue, dispatches `auth:expired` and keeps every mutation; the drain resumes
   after the next login of the same user.
3. Mutations store `userId`; the drain only processes the current user's mutations. Read-cache
   keys are prefixed with the user id; logout clears the read cache (planner decision).
4. Before sending, if the URL or payload still contains a `temp-` id that is not in the resolved
   map, the mutation fails with a translated "depends on a discarded change" message and the
   discard action.
5. `replaceTemporaryIds` replaces exact ids only (match whole path segments and whole string
   values; process longer ids first).
6. After a drain, `OfflineQueueContext` exposes the resolved temp → real id map with
   `syncVersion`; the detail page replaces resolved temporary entries by id and, on a full reload,
   drops pending entries whose mutation no longer exists.
7. `loadEntries` ignores results whose list id is no longer current; the `resyncVersion` reset on
   token change no longer triggers an extra reload.
Tests first: offline add then sync leaves exactly one entry; queued PATCH after a discarded POST
shows the discard action; a 401 pauses without discarding; ids `temp-1` and `temp-10` resolve
independently; user B never sees user A's cached lists.

### T-015 — Editing keeps the chosen icon; icons can be cleared

Files: `frontend/src/components/AddItemSheet/AddItemSheet.tsx`, `backend/src/routes/entries.js`
or `services/entryService.js` (after T-010), `frontend/src/api/entries.ts`, tests
`AddItemSheet.test.tsx`, `entries.test.js`, `README.md` (icon assignment).

1. In edit mode the suggestion only replaces the selected icon after the user changed the text;
   a manual pick is never overwritten.
2. PATCH accepts `icon: null` to clear the icon (an `hasIcon` presence flag, like `hasDetails`).
Tests first: opening edit for an entry with a custom icon and saving keeps it; changing the text
adopts the new suggestion; PATCH `{icon:null}` stores null.

### T-016 — Cache-first overview and lighter detail metadata

Depends on T-011, T-014. Files: `frontend/src/pages/OverviewPage/OverviewPage.tsx`,
`useListDetailData.ts`, `frontend/src/api/lists.ts`, tests `OverviewPage.test.tsx`,
`ListDetailPage.test.tsx`, `README.md` (loading bullet).

1. Overview passes `onCachedValue` to `fetchLists` and shows the loader only when no data exists;
   event-driven reloads refresh in place.
2. Detail page fetches its metadata through `GET /api/lists/:id` instead of `fetchLists`.
Tests first: cached lists render before the network resolves; `list:updated` does not show the
loader; the detail page no longer calls `/api/lists`.

### T-017 — Render cost and bundle size

Files: `frontend/src/App.tsx`, `frontend/src/components/EntryTile/EntryTile.tsx`,
`ListDetailPage.tsx`, `frontend/src/context/OfflineQueueContext.tsx`,
`frontend/src/context/AuthContext.tsx`, `frontend/index.html`, `frontend/public/icon-192.png`,
`frontend/vite.config.ts` (if chunking changes), tests `EntryTile.test.tsx`,
`vite-config.test.ts`, `app.test.tsx`, `README.md` (cold-load section).

1. `EntryTile` wrapped in `memo`; `onEdit(id)`/`onToggle(id)` stable callbacks; the original entry
   object is passed; `openEntries`/`visibleEntries` memoised; `useDeferredValue` for the search.
2. Provider values of `OfflineQueueContext` and `AuthContext` memoised.
3. `React.lazy` + `Suspense` for Login, Register, ForgotPassword, ResetPassword, VerifyEmail and
   InviteAccept pages and for the Share, Rename, Options, Info and AddItem sheets. Lazy chunks for
   the list detail must still be available offline (precache keeps them).
4. `<link rel="preload" href="/fonts/exo-2-latin.woff2" as="font" type="font/woff2" crossorigin>`.
5. Re-encode `icon-192.png` losslessly (192×192, still maskable) to below 15 KB.
6. Re-measure the cold load exactly as in the previous cycle and update the README figures.
Acceptance: entry chunk smaller than 100 KB gzipped; cold-load budget still met; offline reopen
of a list still works.

### T-018 — Precomputed icon embeddings

Files: new `frontend/scripts/build-icon-embeddings.mjs`, new `frontend/src/data/iconEmbeddings.bin`
(or `.json`), `frontend/src/workers/iconWorker.ts`, `frontend/vite.config.ts`, `frontend/package.json`
(script), new `iconWorker.test.ts`, new `iconEmbeddings.test.ts`, `README.md` (icon assignment,
how to regenerate).

1. The script loads the same model and quantisation as the worker, embeds every `ICON_DB` entry
   with the same label/tag text, and writes Float32 vectors plus a SHA-256 of the input texts.
2. The worker fetches the asset once and only embeds the query text.
3. A unit test recomputes the hash from `ICON_DB` and fails with the regeneration command when the
   asset is stale.
4. Exclude the unused `ort-wasm*asyncify.wasm` from `dist` if the runtime loads WASM from the CDN
   (verify in the built worker first; if it is used locally, keep it and record why).
Acceptance: the first semantic suggestion performs one inference; suggestions for the existing
`iconRegistry`/worker fixtures are unchanged.

### T-019 — nginx caching and compression

Depends on T-005 (same file). Files: `docker/nginx.conf`, `README.md` (cold-load section,
Cloudflare notes), new or extended config test (e.g. `vite-config.test.ts` sibling for nginx).

1. `location ^~ /assets/` → `Cache-Control: public, max-age=31536000, immutable`.
2. `location = /service-worker.js` and `location = /index.html` (and the SPA fallback) →
   `Cache-Control: no-cache`.
3. `/fonts/`, `/icon-*.png`, `/manifest.webmanifest` → `public, max-age=86400`.
4. `gzip_vary on; gzip_comp_level 5;` and `gzip_types` add `application/wasm`,
   `application/manifest+json`, `font/woff2` excluded (already compressed).
5. Security headers from T-005 must be repeated in locations that use `add_header`
   (nginx inheritance rule) — use an `include` snippet.
6. Re-check the README cold-load model (it relies on immutable hashed assets).

### T-020 — Stable error codes with translations

Depends on T-009. Files: new `backend/src/errors.js` (`ApiError`, codes), every router in
`backend/src/routes/`, `backend/src/middleware/*`, `backend/src/app.js` (error handler, pool check
once at startup), `frontend/src/api/request.ts`, `frontend/src/api/client.ts`, new
`frontend/src/api/errors.ts` (`ApiError {status, code}`, `getErrorMessage`), every page/component
with a local `getErrorMessage`, locales, `backend/src/openapi/v1.yaml` (Error schema), tests across
both workspaces, `README.md` (API conventions).

1. Every error response is `{ error, code }` with codes such as `auth.invalid_token`,
   `list.not_found`, `list.forbidden`, `entry.limit_open`, `invite.email_mismatch`, `rate_limited`.
2. Routes throw `ApiError`; the central handler serialises it. The per-handler `if (!pool)` guard
   is removed; `createApp` throws when no pool is provided outside tests that inject one.
3. Frontend: one `getErrorMessage(error, t)` translating by `code`, falling back to the server
   text; the 8 local copies are removed.

### T-021 — Frontend types match the API

Depends on T-020. Files: `frontend/src/types.ts`, `frontend/src/api/*.ts`, `useListDetailData.ts`,
components using members/entries, `frontend/package.json` (`typecheck`), root `package.json`
lint/CI wiring, `.github/workflows/ci.yml`, `README.md` (Validation).

1. `Member` uses `user_id`; `Entry.details: string | null`; `List` gains `owner_id`, `owner_name`.
2. `sendJsonRequest<T>`; mutation results typed as `{ queued: true } | { queued?: false; entry: Entry }`.
3. Remove the `Detail*` re-declarations and casts; fix the three pre-existing `tsc` errors.
4. Add `npm run typecheck` (`tsc --noEmit -p frontend`) and run it in the CI lint job.

### T-022 — Split the list detail hook

Depends on T-013, T-014, T-016, T-021. Files: `frontend/src/pages/ListDetailPage/useListDetailData.ts`
→ `useListEntries.ts`, `useListMembers.ts`, `useRecentlyUsed.ts`, `ListDetailPage.tsx`,
`frontend/src/api/entries.ts`, `frontend/src/api/lists.ts` (exported cache-key helpers), new
`frontend/src/api/sseEvents.ts` (event names shared by `EventSourceContext`), tests
(`ListDetailPage.test.tsx` adjusted only where it imported internals), README if it names files.

1. Each hook exposes commands (`addEntry`, `toggleEntry`, `renameList`, `revokeMember`, ...) and
   no raw setters; errors are typed `{ kind: "access" | "request"; code?; message }`.
2. Cache keys come from exported helpers; `members:${listId}` and `entries:${listId}` literals
   disappear from pages.
3. SSE event names are declared once.
Behaviour must stay identical: existing `ListDetailPage.test.tsx` assertions may not be weakened.

### T-023 — Test coverage gaps

Files: `backend/src/entries.test.js`, `sharing.test.js`, `push.test.js`, new
`integration/access.test.js`, new tests for auth pages under `frontend/src/pages/*/`, new
`frontend/src/sw/service-worker.test.js`, e2e new `e2e/sharing.spec.js`, `e2e/lists.spec.js`,
`README.md` (E2E section).

1. 403 for GET/POST/PATCH/DELETE entries by a stranger (no write query, no SSE, no push);
   non-owner GET/POST/DELETE on members → 403 without mail; unknown member → 404; empty email → 400.
2. Push subscribe 400/401 cases; VAPID key endpoint when unconfigured.
3. React Testing Library tests for Login (redirect handling), Register (invite token),
   ForgotPassword, ResetPassword, VerifyEmail, InviteAccept.
4. Service worker: push without data shows the default text; click focuses an existing window and
   navigates; no window → `openWindow`.
5. E2E with two browser contexts: owner shares, member accepts, owner adds an item, member sees it
   without reload, owner revokes, member is sent to the overview.
6. Replace `waitForTimeout(1500)` in `e2e/lists.spec.js:92` with a deterministic signal.

### T-024 — Route-based fetch fake for the app tests

Files: new `frontend/src/test/fetchRoutes.ts`, `frontend/src/app.test.tsx`, other tests using
ordered `mockResolvedValueOnce` fetch chains.

1. A small route table fake (`method + path pattern → handler`) replaces the 62 order-dependent
   fetch fixtures; unmatched requests fail the test with the request printed.
2. Assertions stay identical; no test is deleted. If an assertion turns out to depend on request
   order, keep it explicit with a recorded-requests check.

## Validation

- `npm run lint`
- `npm run build`
- `npm test`
- Integration suite with `TEST_DATABASE_URL` (CI; locally when PostgreSQL is available)
- From T-021 on: `npm run typecheck`
- Tasks touching cold load (T-017, T-018, T-019): repeat the cold-load measurement method from
  the previous cycle's README section.
