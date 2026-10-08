# ROADMAP

Goal: fix every verified finding of the full-codebase review of 2026-10-08 — security, correctness,
data integrity, performance, maintainability and test coverage — without regressing offline
behaviour, i18n or the cold-load budget reached in the previous cycle (1.9.3).

Source: the five-track review (bugs, security, architecture, performance, test coverage) run on
2026-10-08 against `fb1b7e9`. Every finding listed here was re-checked against the code; file and
line references point at that commit.

## Decisions (taken by the user on 2026-10-08)

1. **Invite acceptance is bound to the invited email.** An invite link can only be accepted by the
   account whose email matches `invited_email` (case-insensitive). Everyone else gets 403 with a
   translated explanation. The list owner can never accept an invite to their own list.
2. **API keys are stored hashed and shown once.** The database keeps a SHA-256 hash plus a short
   hint. The full key is only returned by the generate/rotate call. Existing keys are migrated in
   place and keep working.
3. **Live updates patch from the event payload.** Entry SSE events carry the changed entry row and
   the actor; clients apply it locally instead of refetching entries and history on every event.
   A full refetch remains for resync (reconnect, foreground, queue sync).
4. **All maintainability refactors are in scope** (type drift, hook split, error codes with
   translation, memoisation, code splitting), scheduled after the bug, security and performance
   work.

## Decisions taken by the planner (override before `start_plan` if you disagree)

- `POST /api/auth/register` keeps answering 409 for an existing email. Enumeration through it is
  accepted as a usability trade-off and mitigated by rate limiting; the login timing leak is fixed.
- A password reset invalidates all sessions and **clears the API key**; the Home Assistant
  integration has to be re-keyed after a reset. This is documented in the README and the reset
  success message.
- Swagger UI stays public; it documents an already public API and is a listed feature.
- HSTS is left to the TLS terminator (Cloudflare); nginx inside the container only speaks HTTP.
- The SSE stream authenticates with a short-lived single-use ticket instead of the JWT in the query
  string. The backend remains single-instance; tickets live in process memory.
- On logout the read cache is cleared. Queued offline writes are tagged with their user and kept
  until that user signs in again; another account never sees or replays them.

## Priority 1 — Security (critical/high)

- The `/api/test` router is reachable in the production image because `NODE_ENV` is never set
  (`backend/src/app.js:91-93`, `Dockerfile`). Gate it behind an explicit `ENABLE_TEST_ROUTES=true`.
- `JWT_SECRET` defaults to `""` and accepts the `change-me` example values (`backend/src/env.js:15`).
  Refuse to start without a strong secret; pin HS256.
- JWTs, API keys and one-time tokens are written to logs (`backend/src/logger.js:3-5`, pino-http
  default serializers, `?token=` URLs, nginx access log).
- No rate limiting on login, register, forgot/reset password, resend verification and invites.
- Invite links can be accepted by any signed-in user (`backend/src/routes/invites.js:19-37`).
- Password reset neither revokes sessions nor consumes its token atomically
  (`backend/src/routes/auth.js:401-457`).
- API key and one-time tokens are stored in plaintext; the API key can be re-read at any time.
- No CSP or security headers (`docker/nginx.conf`), `X-Powered-By` exposed.
- Lower: login timing enumeration, no password policy, push endpoint SSRF (no host allowlist),
  backend runs as root, CI without `permissions:`, actions pinned to tags, unvalidated
  `?redirect=` on the login page.

Acceptance criteria:

- A production container answers 404 on `/api/test/*`; E2E still creates users through it.
- The backend exits at startup with a clear message when `JWT_SECRET` is empty, shorter than 32
  characters or contains `change-me`.
- No log line (backend or nginx) contains an `Authorization` header, an `X-Api-Key` header, a JWT,
  or a verification/reset/invite token.
- The 6th failed login within the window from one IP or for one email returns 429.
- Accepting an invite as a different account returns 403 and adds no membership.
- After a password reset, previously issued JWTs return 401 and the reset link cannot be reused.
- The database holds no plaintext API key or one-time token; an existing API key still works
  after the migration.

## Priority 2 — Correctness and data integrity

- Push notifications never enqueue: a JS array is bound to the `jsonb` column `items`
  (`backend/src/workers/pushWorker.js:33,53`).
- One non-410 push error aborts the tick and re-sends the job every 5 s; ticks can overlap
  (`pushWorker.js:67-73,247-265`). Concurrent enqueue loses items.
- Entries added offline appear twice after sync (`useListDetailData.ts:97,447`,
  `listDetailUtils.ts:11-17`).
- A queued mutation that still references an unresolved temporary ID makes the server answer 500
  (`22P02`), and the queue retries forever (`offlineQueueDrain.ts:33-37`). The same 500 hits any
  malformed UUID in a path, API key or invite token.
- Queued writes replay with the token captured when queued; a 401 is treated as "discard".
  Cache and queue are not scoped per user.
- Marking an entry done can delete an unrelated done entry before the target is validated
  (`entries.js:191-216`); limits, reset tokens, invite acceptance and push enqueue are not atomic.
- A mail failure returns 500 after the database change was committed (`sharing.js:161,224`,
  `lists.js:274`, `auth.js:141`).
- The v1 API skips entry limits, push notifications and `last_updated_by` (`v1.js:122-379`).
- A removed member never receives `member:removed`; the detail page ignores `list:deleted` and
  `list:updated`.
- The edit sheet replaces a custom icon with the suggestion (`AddItemSheet.tsx:81-83`); icons
  cannot be cleared (`entries.js:224`).

Acceptance criteria:

- Adding an entry to a shared list enqueues exactly one push job row with a JSON array of items,
  verified against real PostgreSQL.
- An expired (404/410) subscription is deleted and the job still completes once for everyone else.
- Going offline, adding "Bread" and reconnecting leaves exactly one "Bread" in the list.
- A queued mutation with an unresolved temporary ID surfaces the discard action instead of
  retrying; malformed UUIDs return 400/404, never 500.
- After re-login, queued writes replay with the current token; a 401 pauses the queue and shows
  the session-expired flow without discarding anything.
- Toggling an unknown or already-done entry never deletes another entry.
- v1 writes respect the same limits, set `last_updated_by` and enqueue pushes.
- A removed member's open list page leaves the list with a translated notice.
- Editing only the details of an entry keeps its icon.

## Priority 3 — Performance

- No index on `entries(list_id)`, `lists(owner_id)`, `list_members(user_id)`,
  `pending_push_jobs(fire_at)`; `pg_trgm` only exists through a dropped table's migration.
- Each entry SSE event triggers 2 full GETs per member (resolved by Decision 3).
- The icon worker embeds all 201 catalogue entries on every start (`iconWorker.ts:78-87`).
- The overview does not render from cache on a cold start (`OverviewPage.tsx:70`); the detail
  page runs the full overview query for one list's metadata.
- Unmemoised tiles and context values; no route-level code splitting; no font preload;
  `icon-192.png` larger than `icon-512.png`; a 23.5 MB unused WASM file in `dist`.
- nginx marks unhashed files (`service-worker.js`, fonts, PWA icons) immutable for a year, sends
  no `Cache-Control` for `index.html`, and compresses at level 1 without `Vary`.

Acceptance criteria:

- `EXPLAIN` of the entries, history, suggestions and overview queries uses index scans on a
  seeded database.
- Toggling one entry on a 3-member list causes no follow-up GET on any client.
- The first semantic icon suggestion needs one model inference, not 202.
- The overview shows cached lists before the network answers.
- The cold-load budget of the previous cycle (< 500 KiB, no response > 150 KiB) still holds, and
  the entry chunk shrinks.
- `/service-worker.js` and `/index.html` are served `no-cache`; `/assets/*` immutable.

## Priority 4 — Maintainability

- Errors are English free text; the client cannot translate or distinguish them; the
  `if (!pool)` guard is repeated about 37 times; every unexpected error becomes 500.
- Frontend types drift from the API (`types.ts:25-29`, `Detail*` re-declarations, casts).
- `useListDetailData.ts` (523 lines) returns 19 values including raw setters; cache keys and SSE
  event names are duplicated.
- OpenAPI drift (`v1.yaml:100` mentions a dropped table; 3.0 `nullable` in a 3.1 document).

Acceptance criteria:

- Every error response carries a stable `code`; the UI shows DE/EN text for each code.
- `tsc --noEmit` passes for the frontend and runs in CI.
- The list detail hook is split into focused hooks that expose commands, not setters.

## Priority 5 — Test coverage

- Backend tests never execute SQL; CI's unit job has no PostgreSQL; migrations never run `down`.
- No 403 tests for entries and for non-owners on sharing routes; no expired/forged JWT tests;
  auth pages only have source-text tests; no service-worker or icon-worker behaviour tests;
  no multi-user E2E; `e2e/lists.spec.js:92` sleeps; `app.test.tsx` depends on fetch order.

Acceptance criteria:

- An integration suite runs every PR against PostgreSQL 16 and covers access control, token
  expiry, invite acceptance and push enqueue; migrations round-trip up → down → up.
- A two-browser E2E covers share → accept → live update → revoke.
