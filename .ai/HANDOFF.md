# HANDOFF

Append-only role handoff log. Each role adds one entry when its step is complete.

## Entry Template

Each entry uses this exact structure. Omit fields marked as role-specific when they do not apply.

---

### <TASK_ID> — <ROLE> — <YYYY-MM-DDTHH:MM:SSZ>

| Field | Value |
|-------|-------|
| Agent | claude \| codex |
| Summary | One-sentence description of work done |
| Files Changed | Comma-separated list of changed files |
| Validation | Commands run and outcomes (implement only) |
| Commit | `<hash> <conventional commit message>` (implement only) |
| Verdict | PASS \| PASS_WITH_NOTES \| FAIL (review only) |
| Blocking Findings | Numbered list or "none" (review only) |
| Next Role | plan \| implement \| review \| none |

---

### T-001 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned production-safe startup: explicit ENABLE_TEST_ROUTES gate, NODE_ENV in the image, startup validation of JWT_SECRET/DATABASE_URL, and HS256 pinning. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-002 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned the real-PostgreSQL integration-test harness with per-file schemas, a migration up/down/up round-trip and a Postgres service in the CI unit job. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-003 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned the push pipeline fix: jsonb binding, ON CONFLICT enqueue, SKIP LOCKED claim, per-subscription error handling, non-overlapping ticks and an endpoint allowlist. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-004 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned log redaction, query-free request logging in pino and nginx, and single-use SSE tickets replacing the JWT in the query string. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-005 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned rate limits, trust proxy, constant-time login, password policy, safe login redirects, CSP and security headers, non-root backend and CI hardening. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-006 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned session revocation through token_version and an atomic, single-use password reset that also clears the API key. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-007 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned hashing of API keys and one-time tokens with an in-place migration and the show-once API key UI in the InfoSheet. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-008 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned invite acceptance bound to the invited email, owner exclusion and atomic single-use acceptance with translated errors. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-009 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned withTransaction, race-free entry limits, UUID validation, pg error mapping and mail sending after commit. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-010 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned a shared entryService used by the app API and v1, plus OpenAPI drift fixes. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-011 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned the query-index migration with explicit pg_trgm, pool settings and a GET /api/lists/:id endpoint. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-012 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned direct member:removed delivery, non-blocking list:deleted, and detail/overview handling of list lifecycle events. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-013 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned SSE entry events carrying the entry row and actor, applied idempotently on clients instead of refetching (user Decision 3). |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-014 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned offline queue fixes: current-token replay, 401 pause, unresolved temp-id failure, exact id replacement, temp-entry reconciliation and per-user scoping. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-015 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned keeping a chosen icon while editing and allowing icons to be cleared through PATCH. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-016 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned cache-first rendering on the overview and the single-list endpoint for detail metadata. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-017 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned memoisation, route and sheet code splitting, font preload and a smaller icon-192 within the existing cold-load budget. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-018 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned build-time icon embeddings with a staleness test and removal of the unused WASM asset. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-019 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned nginx cache-control per asset class, gzip tuning and header inheritance via an include snippet. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-020 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned stable error codes with DE/EN translation, a central error handler and removal of per-route pool guards. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-021 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned aligning frontend types with the API, a generic request helper and a CI typecheck. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-022 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned splitting useListDetailData into command-based hooks with shared cache keys and SSE event names. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-023 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned the missing 403/IDOR, push, auth page, service worker and two-user E2E tests and removal of fixed sleeps. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-024 — plan — 2026-10-08T13:35:27Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned a route-based fetch fake replacing order-dependent fixtures in app.test.tsx without weakening assertions. |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

---

### T-001 — implement — 2026-10-08T13:49:06Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Test routes are opt-in via ENABLE_TEST_ROUTES, startup exits on a missing DATABASE_URL or a weak/placeholder JWT_SECRET, and JWTs are signed and verified as HS256 only. |
| Files Changed | backend/src/env.js, backend/src/index.js, backend/src/app.js, backend/src/middleware/auth.js, backend/src/routes/auth.js, backend/src/routes/testRouter.js, backend/src/env.test.js, backend/src/index.test.js, backend/src/testRoutes.test.js, backend/src/jwtHardening.test.js, Dockerfile, playwright.config.js, .github/workflows/ci.yml, .env.example, docker-compose.example.yml, README.md |
| Validation | `npm run lint` (0 errors, 1 pre-existing warning); `npm run build` ok; `npm test` backend 197/197 and frontend 616/616 pass. E2E not run locally (needs PostgreSQL). |
| Commit | `fix(security): refuse weak JWT secrets at startup and make test routes opt-in` |
| Next Role | review |

Notes for review: the local gitignored `.env` still has `JWT_SECRET=change-me`, so `npm run dev` and `npm run e2e` exit at startup until it is replaced (see `.env.example`). `docker-compose.example.yml` now uses a 41-character placeholder as the plan requires; it passes validation if copied unchanged, so the README tells users to generate their own. `validateConfig` is only enforced in `startServer`, not `createApp`.

---

### T-001 — review — 2026-10-08T14:10:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed production-safe startup: test routes opt-in, strong JWT secret enforced at startup, HS256 pinned; all acceptance criteria met. |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

---

### T-001 — implement — 2026-10-08T13:59:11Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Committed T-001 after review PASS_WITH_NOTES: test routes opt-in, strong JWT secret enforced at startup, HS256 pinned. |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md, plus all T-001 implementation files |
| Commit | `fix(security): refuse weak JWT secrets at startup and make test routes opt-in` |
| Next Role | none |

---

### T-002 — implement — 2026-10-08T14:06:47Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Added a PostgreSQL integration-test harness (schema per test file, real migrations), owner/member/stranger access tests, an up→down→up migration round-trip and a Postgres service in the CI unit job. |
| Files Changed | backend/src/integration/helpers.js, backend/src/integration/access.test.js, backend/src/integration/migrations.test.js, backend/package.json, package.json, .github/workflows/ci.yml, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | `npm run test:integration` against local postgres:16 (`TEST_DATABASE_URL`): 8/8 pass; without it the suites skip. `npm run lint` (0 errors, 1 pre-existing warning); `npm run build` ok; `npm test` backend 197/197, frontend 616/616 pass. |
| Commit | `test(backend): add PostgreSQL integration harness with migration round-trip and access tests` |
| Next Role | review |

Notes for review: pgcrypto is created once in `public` by the harness (advisory-locked) so dropping a test schema never drops the extension; `noLock: true` is used for the runner because schemas are isolated. Integration tests use `*.test.js` names, so `npm test` also discovers them but they skip without `TEST_DATABASE_URL`. The CI service creates `endgame_grocery_test` via `POSTGRES_DB`. The route-level tests pass a real `createRequireAuth` bound to the test secret, since routers otherwise read the secret from the process env.

---

### T-002 — review — 2026-10-08T14:30:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed the PostgreSQL integration harness, migration round-trip, access tests and CI Postgres service; criteria met by inspection, integration suite not executed by the reviewer. |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

---

### T-002 — implement — 2026-10-08T14:40:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Committed T-002 after review PASS_WITH_NOTES: PostgreSQL integration harness, migration round-trip, access tests and Postgres in the CI unit job. |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md, plus all T-002 implementation files |
| Commit | `test(backend): add PostgreSQL integration harness with migration round-trip and access tests` |
| Next Role | none |

---

### T-003 — implement — 2026-10-08T14:35:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Push jobs are now enqueued and claimed with single atomic SQL statements and a jsonb array, a failing subscription no longer aborts delivery to the others, ticks never overlap, and subscribe only accepts https endpoints of known push services. |
| Files Changed | backend/src/workers/pushWorker.js, backend/src/routes/push.js, backend/src/pushWorker.test.js, backend/src/push.test.js, backend/src/entries.test.js, backend/src/integration/push.test.js, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | `npm run test:integration` against local postgres:16: 16/16 pass (8 new push tests incl. concurrent enqueue and concurrent workers). `npm run lint` (0 errors, 1 pre-existing warning); `npm run build` ok; `npm test` backend 216/216, frontend 616/616 pass. |
| Commit | `fix(push): deliver push notifications reliably and accept only known push-service endpoints` |
| Next Role | review |

Notes for review: existing unit tests were adapted because the SQL changed on purpose (enqueue is one `INSERT … ON CONFLICT` so `entries.test.js` now sees 4 queries instead of 5; the claim query is `DELETE … FOR UPDATE SKIP LOCKED` so the worker mocks match `SKIP LOCKED` and the old "job deleted" assertions became "no separate delete follows"). No log message or logged field was changed; a new warn "Push notification failed" is emitted for non-404/410 errors. The allowlist matches the host or a subdomain on a dot boundary (so `evilfcm.googleapis.com` is rejected) and also rejects credentials in the URL. The worker does not re-validate stored endpoints at send time (rows saved before this change are not purged); noted rather than added because the plan does not require it. A claimed job is lost if the process crashes mid-delivery (accepted trade-off of claim-by-delete).

---

### T-003 — review — 2026-10-08T14:55:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed the push pipeline fix (atomic enqueue and claim, per-subscription errors, non-overlapping ticks, endpoint allowlist); criteria met by inspection and unit tests, integration suite not executed by the reviewer. |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

---

### T-003 — implement — 2026-10-08T15:00:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Committed T-003 after review PASS_WITH_NOTES: atomic push enqueue and claim, per-subscription error handling, non-overlapping ticks and endpoint allowlist. |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md, plus all T-003 implementation files |
| Commit | `fix(push): deliver push notifications reliably and accept only known push-service endpoints` |
| Next Role | none |

---

### T-004 — implement — 2026-10-08T15:30:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Request logs no longer contain credentials (header redaction, query-free path-only request serializer, masked invite tokens, query-free nginx format), and the event stream is opened with a single-use 30 s ticket from `POST /api/events/ticket` instead of the JWT in the URL. |
| Files Changed | backend/src/logger.js, backend/src/app.js, backend/src/sseTickets.js, backend/src/sseTickets.test.js, backend/src/logging.test.js, backend/src/nginxLogging.test.js, backend/src/routes/events.js, backend/src/routes/events.test.js, backend/src/jwtHardening.test.js, docker/nginx.conf, frontend/src/api/events.ts, frontend/src/api/events.test.ts, frontend/src/context/EventSourceContext.tsx, frontend/src/context/EventSourceContext.test.tsx, frontend/src/app.test.tsx, e2e/resync.spec.js, e2e/queue-retry.spec.js, e2e/lists.spec.js, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | `npm run lint` (0 errors, 1 pre-existing warning); `npm run build` ok; `npm test` backend 242/242, frontend 625/625 pass. Not run locally: nginx (`nginx -t`) and the Playwright specs (docker/E2E blocked or the local `.env` still has the rejected `change-me` secret). |
| Commit | `feat(security): keep credentials out of logs and open the event stream with single-use tickets` |
| Next Role | review |

Notes for review: (1) `?token=` is removed from `GET /api/events`; the Authorization header still works and `POST /api/events/ticket` issues tickets (in-memory, single instance, README says so). (2) `EventSourceContext.test.tsx` reconnect-manager tests were made async (helpers `mount`/`advance`/`wake` flush the ticket promise); no assertion was removed. The only changed expectations are the stream URL (`?ticket=`), the StrictMode instance count (the first setup is cleaned up before its ticket arrives, so 1 stream instead of 2) and the token-change test (asserts the ticket request used the new token). Five new tests cover ticket use, fresh ticket per reconnect, backoff on a failed ticket request, no retry on `AuthExpiredError`, and late tickets after unmount. (3) `app.test.tsx` answers `/api/events/ticket` in its fetch wrapper (like `/api/health`; it rejects when offline because a successful reply would prove connectivity). The three Playwright specs that mock `/api/` got a ticket route. (4) The nginx plan used `$uri`; I additionally mask invite tokens (`/invite/<token>`, `/api/invites/<token>`) with two maps and `access_log … if=` because those tokens are path segments and the acceptance criteria exclude one-time tokens from logs. The config could not be validated with `nginx -t`; `nginxLogging.test.js` asserts the directives textually, so CI/build should confirm startup. (5) The pino-http `req` serializer logs only method, path and remote address, so headers are never logged; `redact` is a second layer on the default logger.

---

### T-004 — review — 2026-10-08T16:00:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed credential-free logging and SSE tickets; backend parts pass, but the nginx access log still records the full Referer, which carries reset/verify/invite tokens from the app's mail links. |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | FAIL |
| Blocking Findings | 1. docker/nginx.conf logs "$http_referer" in both log formats, leaking one-time tokens from /reset-password?token=, /verify-email?token= and /invite/<token> pages. |
| Next Role | implement |

---

### T-004 — implement — 2026-10-08T16:10:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Rework: removed `$http_referer` from both nginx log formats (it carried one-time-token URLs such as `/reset-password?token=…`) and added tests that fail if the referer or any non-allowlisted variable is logged. |
| Files Changed | docker/nginx.conf, backend/src/nginxLogging.test.js, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | `npm run lint` (0 errors, 1 pre-existing warning); `npm run build` ok; `npm test` backend 244/244, frontend 625/625 pass. `nginx -t` still not run (docker commands are blocked here). |
| Commit | `feat(security): keep credentials out of logs and open the event stream with single-use tickets` |
| Next Role | review |

Notes for review: the one required fix (finding 1) is done; scope and commit message are unchanged. `nginxLogging.test.js` now also asserts that the log formats only use an allowlist of variables (`remote_addr`, `remote_user`, `time_local`, `request_method`, `uri`, `server_protocol`, `status`, `body_bytes_sent`, `http_user_agent`), so a later change cannot reintroduce a query- or header-bearing variable unnoticed. README wording mentions the omitted `Referer`. Findings 2 and 3 (config check, two maps) were not required; `nginx -t` remains unverified locally. The note about nginx error logs containing request lines is left for T-005.

---

### T-004 — review — 2026-10-08T16:40:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Re-reviewed T-004 after rework: the Referer is no longer logged by nginx and a variable allowlist test guards the formats; all criteria met. |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

---

### T-004 — implement — 2026-10-08T16:50:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Committed T-004 after review round 2 PASS_WITH_NOTES: credential-free backend and nginx logs and single-use ticket authentication for the event stream. |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md, plus all T-004 implementation files |
| Commit | `feat(security): keep credentials out of logs and open the event stream with single-use tickets` |
| Next Role | none |

---

### T-005 — implement — 2026-10-08T17:30:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Added rate limits (login, mail endpoints, reset, invites), trust-proxy, constant-time unknown-user login, a 8-char/72-byte password policy on server and UI, safe login redirects, nginx security headers with a CSP verified in Chromium, a non-root backend, and least-privilege, SHA-pinned workflows. |
| Files Changed | backend/package.json, package-lock.json, backend/src/app.js, backend/src/middleware/rateLimit.js, backend/src/passwordPolicy.js, backend/src/routes/auth.js, backend/src/routes/sharing.js, backend/src/hardening.test.js, backend/src/passwordPolicy.test.js, backend/src/containerHardening.test.js, backend/src/releaseWorkflow.test.js, docker/nginx.conf, docker/security-headers.conf, docker/supervisord.conf, Dockerfile, .github/workflows/ci.yml, .github/workflows/docker-publish.yml, .github/workflows/release-please.yml, frontend/src/utils/safeRedirect.ts, frontend/src/utils/passwordPolicy.ts, their tests, frontend/src/pages/authPagesHardening.test.tsx, frontend/src/pages/LoginPage/LoginPage.tsx, frontend/src/pages/RegisterPage/RegisterPage.tsx, frontend/src/pages/ResetPasswordPage/ResetPasswordPage.tsx, frontend/src/styles/auth.module.css, frontend/src/locales/de/translation.json, frontend/src/locales/en/translation.json, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | `npm run lint` (0 errors, 1 pre-existing warning); `npm run build` ok; `npm test` backend 289/289, frontend 667/667 pass; integration suite 16/16 against local postgres:16. CSP verified with a throwaway Playwright/Chromium script against the production `dist` served with the exact headers from `docker/security-headers.conf`: zero violations for login, list detail (service worker registered), first icon-model download (Hugging Face + jsDelivr), push opt-in click, and Swagger UI at `/api/docs/` (6 operations rendered, no override needed). nginx itself was not started (`nginx -t` unavailable), and the E2E specs were not run. |
| Commit | `feat(security): rate-limit auth endpoints, enforce a password policy and ship security headers` |
| Next Role | review |

Notes for review:
1. **CSP deviation, with evidence:** the plan's `script-src` lacks `blob:`. In Chromium the production build's icon worker made a request to a `blob:` URL that was blocked by CSP (visible as `requestfailed … csp`; absent without CSP). Adding `blob:` to `script-src` removed it with no other change, so `docker/security-headers.conf` has `script-src 'self' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net`; README documents each directive and `containerHardening.test.js` pins it. I could not tell from screenshots whether semantic inference silently degraded without it (the test words hit keyword matches), so please treat it as precautionary but evidence-based.
2. **Rate limits are disabled when `ENABLE_TEST_ROUTES=true`** (not in the plan): the Playwright auth spec registers ~5 users and fails logins from one IP and would hit the 5/hour limits (and retries would make it flaky). Production never sets that flag; tested and documented.
3. **nginx header inheritance:** the asset location sets `Cache-Control`, so server-level `add_header` would not apply there; the headers live in `docker/security-headers.conf`, included at server level and in that location (Dockerfile copies it to `/etc/nginx/security-headers.conf`). A test fails if a location with `add_header` omits the include. T-019 will reuse this for the new cache locations.
4. Existing tests changed: `releaseWorkflow.test.js` now expects `@<40-hex SHA> # vN` instead of `@vN` for the same actions/majors (plus new pinning and permissions tests). No other existing assertion changed.
5. SHAs were resolved with `git ls-remote` against the current major tags (release-please-action's `v5` is an annotated tag; I used the peeled commit). `ci.yml` got workflow-level `contents: read`; the other two already had permissions.
6. `app.set("trust proxy", 1)` assumes nginx is the only hop; README warns that Cloudflare or another proxy in front makes all visitors share one counter unless `real_ip` is configured in nginx.
7. Not done (outside the plan): nginx error logs may still print request lines with query strings on upstream failures (flagged in the T-004 review).
8. Frontend `minLength` was removed from the register/reset password inputs in favour of the JS check, so the translated message (not the browser tooltip) is shown.

---

### T-005 — review — 2026-10-08T17:30:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed rate limits, trust proxy, login timing, password policy, safe redirect, CSP/security headers, non-root backend and pinned workflows; all criteria met by inspection and tests, container not started by the reviewer. |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

---

### T-005 — implement — 2026-10-08T17:50:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Committed T-005 after review PASS_WITH_NOTES: auth rate limits, password policy, safe login redirects, security headers with a verified CSP, non-root backend and pinned least-privilege workflows. |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md, plus all T-005 implementation files |
| Commit | `feat(security): rate-limit auth endpoints, enforce a password policy and ship security headers` |
| Next Role | none |

---

### T-006 — implement — 2026-10-08T18:20:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | JWTs now carry a `tv` claim that is checked against the new `users.token_version` on every authenticated request (and event-stream ticket), and password reset consumes its token atomically in one transaction, bumps the version, deletes the user's other reset tokens and clears the API key. |
| Files Changed | backend/src/db/migrations/1779979000002_add_token_version_to_users.cjs, backend/src/db/migrations.test.js, backend/src/db/client.js, backend/src/middleware/auth.js, backend/src/app.js, backend/src/routes/auth.js, backend/src/routes/events.js, backend/src/sessionRevocation.test.js, backend/src/auth.test.js, backend/src/hardening.test.js, backend/src/integration/auth.test.js, backend/src/integration/access.test.js, backend/src/integration/helpers.js, frontend/src/locales/en/translation.json, frontend/src/locales/de/translation.json, frontend/src/app.test.tsx, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | `npm run test:integration` against local postgres:16: 25/25 pass (migration round-trip includes the new migration; old JWT 401 after reset, concurrent resets → one 200 and one 400, other tokens invalidated, API key cleared, expired/used tokens rejected). `npm run lint` (0 errors, 1 pre-existing warning); `npm run build` ok; `npm test` backend 310/310, frontend 667/667 pass. |
| Commit | `feat(security): sign users out everywhere and make password reset atomic` |
| Next Role | review |

Notes for review:
1. **Middleware shape:** `createRequireAuthFn` is now async and `createRequireAuth` takes a `pool`. `createApp` builds one pool-aware `requireAuthMiddleware` and passes it to every router through `routerOptions` (routers previously defaulted to a module-level instance that read the secret from the process env, so `createApp({ config })` did not reach them). Without a pool (tests only) just the signature is checked; production cannot start without `DATABASE_URL`. DB errors from the lookup go to `next(error)` (500), not to a 401.
2. **Token without `tv` ≡ version 0:** existing sessions stay valid after the migration until the owner resets the password. The migration adds `token_version integer NOT NULL DEFAULT 0`; `down` drops it.
3. **Reset transaction:** new `withTransaction(pool, fn)` in `db/client.js` (T-009 can reuse it). The claim `UPDATE … WHERE token=$1 AND used=false AND expires_at>$2 RETURNING user_id` is the only validity check; bcrypt hashing happens after a successful claim, inside the transaction. The user update sets `password_hash`, `token_version = token_version + 1` and `api_key = NULL` together.
4. **Existing tests adapted, nothing weakened:** six `auth.test.js` route tests and the two reset tests got small mock helpers (`withCurrentTokenVersion` answers the token-version lookup; `withTransactionClient` adds `connect()`); the reset success test now expects the single claim `UPDATE … RETURNING` instead of the earlier SELECT + UPDATE, because that is the behaviour change. `hardening.test.js` default pool got `connect()`. `app.test.tsx` asserts the new reset message with a regex instead of the old exact sentence.
5. **Per-request cost:** one primary-key lookup per authenticated request, as planned; no cache.
6. The reset message (DE/EN) now says the user was signed out elsewhere and that the API key was removed so a new one must be generated for Home Assistant.

---

### T-006 — review — 2026-10-08T18:10:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed token_version session revocation and the atomic password reset; criteria met by inspection and unit tests, integration suite not executed by the reviewer. |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

---

### T-006 — implement — 2026-10-08T18:40:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Committed T-006 after review PASS_WITH_NOTES: token_version session revocation and an atomic, single-use password reset that also clears the API key. |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md, plus all T-006 implementation files |
| Commit | `feat(security): sign users out everywhere and make password reset atomic` |
| Next Role | none |

---

### T-007 — implement — 2026-10-09T06:50:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | API keys and the email-verification, password-reset and invite tokens are stored only as SHA-256 hashes (existing values converted in place), `GET /api/auth/api-key` returns only `has_key`/`hint`/`created_at`, and the InfoSheet shows a new key once with a warning. |
| Files Changed | backend/src/tokens.js, backend/src/tokens.test.js, backend/src/db/migrations/1779979000003_hash_credentials.cjs, backend/src/db/migrations.test.js, backend/src/middleware/auth.js, backend/src/routes/auth.js, backend/src/routes/sharing.js, backend/src/inviteService.js, backend/src/auth.test.js, backend/src/sessionRevocation.test.js, backend/src/sharing.test.js, backend/src/invites.test.js, backend/src/v1.test.js, backend/src/integration/helpers.js, backend/src/integration/auth.test.js, backend/src/integration/credentials.test.js, backend/src/openapi/v1.yaml, frontend/src/api/auth.ts, frontend/src/components/InfoSheet/InfoSheet.tsx, frontend/src/components/InfoSheet/InfoSheet.module.css, frontend/src/components/InfoSheet/InfoSheet.test.tsx, frontend/src/locales/en/translation.json, frontend/src/locales/de/translation.json, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | `npm run lint` 0 errors (1 pre-existing warning); `npm run build` ok; `npm test` backend 315/315, frontend 669/669 pass. Integration suite (`integration/credentials.test.js`, updated `integration/auth.test.js`, migration round-trip) NOT executed locally: no PostgreSQL and the Docker daemon is not running; CI runs it. |
| Commit | `feat(security): store API keys and one-time tokens hashed and show a new API key only once` |
| Next Role | review |

Notes for review:
1. **Migration `1779979000003_hash_credentials`:** adds `users.api_key_hash/hint/created_at` and `token_hash` (NOT NULL, UNIQUE) on the three token tables, fills them with `encode(sha256(convert_to(col::text,'UTF8')),'hex')` of the lower-case uuid text, then drops the plaintext columns. `down` re-creates them (tokens get fresh random values, API keys are empty) and says so in a comment. Not run against PostgreSQL locally; the round-trip and "pre-migration key still authenticates" integration tests will exercise it in CI.
2. **`hashToken`** trims and lower-cases before hashing so the case-insensitive behaviour of the old `uuid` columns is kept. `migrate(direction, count)` in the integration helper gained an optional count so a test can roll back one migration.
3. **API:** `POST /api/auth/api-key` replaces the key and returns `{ api_key, hint, created_at }` once; reset-password also nulls hash, hint and created_at.
4. **UI:** the plaintext is held in component state only and dropped when the sheet closes; an existing key shows `•••• <hint>`; replacing an existing key asks `window.confirm`. DE/EN strings `settings.apiKeyShownOnce` and `settings.apiKeyRegenerateConfirm` added.
5. Existing unit tests only changed where the SQL/params now use hashes (`token_hash`, `api_key_hash`); no assertion weakened. InfoSheet API-key tests were rewritten for the new flow (key shown only after generation).
6. `testRouter.js` needed no change (it does not touch these columns). Invite acceptance by the owner is still allowed here; T-008 covers it.

---

### T-007 — review — 2026-10-09T07:15:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed hashed API keys and one-time tokens plus the show-once API key UI; verified against a real PostgreSQL (integration 31/31, HTTP end-to-end, legacy plaintext rows converted and still usable). |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

### T-007 — implement — 2026-10-09T07:30:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Committed T-007 after review PASS_WITH_NOTES: API keys and one-time tokens stored hashed, API key shown once. |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md, plus all T-007 implementation files |
| Commit | `feat(security): store API keys and one-time tokens hashed and show a new API key only once` |
| Next Role | none |

---

### T-008 — implement — 2026-10-09T08:10:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Invite acceptance is bound to the invited email (403 otherwise), refuses the list owner (409) and is atomic and single use; the invite page shows translated messages with a switch-account action. |
| Files Changed | backend/src/inviteService.js, backend/src/routes/invites.js, backend/src/routes/auth.js, backend/src/invites.test.js, backend/src/auth.test.js, backend/src/integration/invites.test.js, frontend/src/api/client.ts, frontend/src/pages/InviteAcceptPage/InviteAcceptPage.tsx, frontend/src/pages/InviteAcceptPage/InviteAcceptPage.test.tsx, frontend/src/locales/en/translation.json, frontend/src/locales/de/translation.json, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | `npm run lint` 0 errors (1 pre-existing warning); `npm run build` ok; `npm test` backend 319/319, frontend 674/674. `integration/invites.test.js` NOT executed locally (no PostgreSQL, Docker daemon not running); CI runs it. |
| Commit | `feat(sharing): bind invitations to the invited email and make acceptance single-use` |
| Next Role | review |

Notes for review:
1. **Service:** `acceptInviteForUser` now runs in `withTransaction`: `UPDATE list_invites SET status='accepted' WHERE id=$1 AND status='pending' AND expires_at>$2 RETURNING list_id`, then `INSERT … ON CONFLICT DO NOTHING RETURNING user_id` (`memberAdded` = a row came back). It returns `null` when the claim lost. The plan's `accepted_at` column does not exist in the schema and was not added (no requirement beyond status).
2. **Route order:** invite lookup → email check (403) → owner check (409) → claim (400 when lost). A forwarded link therefore never changes state for the wrong account.
3. **Register:** the existing email-match check already prevented auto-verification for foreign invites; a test now pins it. If the claim is lost to a race after the user insert, the account is set back to `email_verified = false` and uses the normal verification flow (T-009 will make register atomic).
4. **Frontend:** `client.ts` throws a new `HttpError` (subclass of `Error`, adds `status`) so the page can map 403/409 to DE/EN texts; other failures still show the server message. Existing callers are unaffected. T-020 will replace this with error codes.
5. Existing `invites.test.js`/`auth.test.js` invite tests were adapted to the transactional flow (no assertion weakened); the 'already a member' case still returns 200 without a broadcast.

---

### T-008 — review — 2026-10-09T08:40:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed email-bound, owner-excluding, atomic single-use invite acceptance and the invite page messages; verified with real SQL (integration 36/36 serially, manual register-with-invite scenarios). |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

### T-008 — implement — 2026-10-09T08:55:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Committed T-008 after review PASS_WITH_NOTES: invites bound to the invited email, owner excluded, acceptance atomic and single use. |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md, plus all T-008 implementation files |
| Commit | `feat(sharing): bind invitations to the invited email and make acceptance single-use` |
| Next Role | none |

---

### T-009 — implement — 2026-10-09T10:00:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Entry create/complete run in row-locked transactions, path ids/invite tokens/API keys are shape-validated, client-caused pg errors map to 400/404/409, notification mails go out after commit without affecting the response, and registration and verification resend are atomic. |
| Files Changed | backend/src/app.js, backend/src/inviteService.js, backend/src/mail/mailer.js, backend/src/middleware/auth.js, backend/src/middleware/validateUuid.js, backend/src/routes/entries.js, backend/src/routes/auth.js, backend/src/routes/lists.js, backend/src/routes/sharing.js, backend/src/testHelpers.js, backend/src/inputValidation.test.js, backend/src/integration/entries.test.js, backend/src/entries.test.js, backend/src/auth.test.js, backend/src/hardening.test.js, backend/src/invites.test.js, backend/src/lists.test.js, backend/src/sharing.test.js, backend/src/history.test.js, backend/src/suggestions.test.js, backend/src/app.test.js, backend/src/v1.test.js, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | `npm run lint` 0 errors (1 pre-existing warning); `npm run build` ok; `npm test` backend 347/347 (frontend untouched, last run 674/674). `integration/entries.test.js` NOT executed locally (no PostgreSQL, Docker daemon not running); CI runs it. |
| Commit | `fix(api): keep entry limits exact under concurrency and stop malformed input and mail outages from failing requests` |
| Next Role | review |

Notes for review:
1. **Entry limits:** create and `status: "done"` PATCH use `withTransaction` and `SELECT 1 FROM lists WHERE id=$1 FOR UPDATE`. Done PATCH also locks the target (`SELECT status … FOR UPDATE`), answers 404 if missing, and only evicts when the target is currently open (eviction query excludes the target id). Non-done PATCHes keep a single statement. v1 routes are untouched (T-010 moves them onto a shared service).
2. **UUID validation:** `validateUuid.js` (`isUuid`, `uuidParam`). `app.param("id")` covers the mount-path list id for history/suggestions/entries/members; `router.param` covers lists (`id`), entries (`entryId`) and sharing (`uid`). Invalid → 404 with the route's existing not-found text (`List not found.` is new for malformed list ids; unknown but well-formed ids still answer 403 as before). `getPendingInviteByToken` returns null for non-UUID tokens without querying (invite route → 400, register ignores the invite). `requireApiKey` answers 401 for non-UUID keys without querying. Param checks run before authentication, so they reveal nothing.
3. **Error handler:** `22P02` → 400, `23505` → 409, `23503` → 404 with generic texts (logged at warn); everything else stays 500. Register keeps its own 23505 → "account already exists" 409 (the error now comes out of the transaction).
4. **Mail after commit:** new `sendMailInBackground(fn, logger)` in `mail/mailer.js` starts the send synchronously and logs failures. Used for invite, revoke, leave, register verification, resend verification and (beyond the plan list) forgot-password, because an SMTP error there would otherwise leak account existence through a 500.
5. **Register:** user insert, optional invite claim/membership and the verification token run in one transaction; `acceptInviteForUser` gained an optional `client` to join it. Mail is sent only after commit.
6. **Test changes:** fixtures with ids like `list-1`/`entry-1`/`user-2` and invite tokens/API keys in URL or lookup position were mechanically replaced with UUIDs (same value everywhere in a file, no assertion changed). Ordered-query fakes in `entries.test.js` gained the two new lock/status statements; a `withTransactions` helper (`src/testHelpers.js`) gives fake pools `connect()` and hides BEGIN/COMMIT/ROLLBACK. One new API-key test pins the no-query rejection.
7. Not done (out of T-009 scope): `DELETE /api/lists/:id` still broadcasts before deleting (T-012).

---

### T-009 — review — 2026-10-09T10:40:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed row-locked entry create/complete, UUID shape validation, pg error mapping, background notification mail and atomic registration; verified with real SQL (integration 42/42 serially) and a manual run with a failing SMTP transport. |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

### T-009 — implement — 2026-10-09T10:30:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Committed T-009 after review PASS_WITH_NOTES: transactional entry limits, UUID/input validation, pg error mapping, mail after commit, atomic register. |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md, plus all T-009 implementation files |
| Commit | `fix(api): keep entry limits exact under concurrency and stop malformed input and mail outages from failing requests` |
| Next Role | none |

---

### T-010 — implement — 2026-10-09T11:30:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | The app entries API and v1 now share one entry service (access, limits, last_updated_by, SSE, push), so v1 writes record the actor, enforce the 422 cap and queue pushes; OpenAPI drops the stale history text and 3.0 `nullable`. |
| Files Changed | backend/src/services/entryService.js, backend/src/routes/entries.js, backend/src/routes/v1.js, backend/src/openapi/v1.yaml, backend/src/v1.test.js, backend/src/docs.test.js, backend/src/integration/entryService.test.js, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | `npm run lint` 0 errors (1 pre-existing warning); `npm run build` ok; `npm test` backend 350/350 (frontend untouched). `integration/entryService.test.js` NOT executed locally (no PostgreSQL, Docker daemon not running); CI runs it. |
| Commit | `feat(api): make Home Assistant item changes record the actor, honour list limits and notify like the app` |
| Next Role | review |

Notes for review:
1. **Service API** (`listEntries`, `createEntry`, `updateEntry`, `deleteEntry`) takes `{ pool, sseManager, logger, userId, listId }` and returns `{ status: "ok" | "forbidden" | "not_found" | "limit_open", ... }`; routes map statuses to their own HTTP texts. The SQL and statement order of the app routes moved over unchanged, so `entries.test.js` passes without edits.
2. **Toggle:** `updateEntry({ toggle: true })` flips the status inside the locked transaction (list + entry `FOR UPDATE`) instead of v1's old read-then-write; eviction at the done cap only for open → done.
3. **v1 behaviour changes (intended):** create/toggle/rename set `last_updated_by`; create enforces the 1,000-open cap with 422 and queues a push; `description` is normalised like the app API (blank → null) and a non-string, non-null value gives 400 `Item description must be a string.`; a non-string `name` now gives 400 (was a possible 500). Toggling to open does not re-check the open cap (same as the app PATCH); rename/toggle do not push (as in the app API).
4. **v1 tests:** the 13 order-dependent fixtures were rewritten around a statement-shape fake (`createEntriesPool`) because the query sequence changed; assertions were kept or strengthened (actor, cap, eviction, blank description). Tests for 400/401/403/404 paths are unchanged.
5. **OpenAPI:** removed the autocomplete-history sentence (toggle now documents the 200-done eviction), `nullable: true` → `type: [string, "null"]`, added a 422 `LimitReached` response on create; `docs.test.js` pins all three.
6. SSE broadcast errors are caught inside the service for both APIs; the app API's push-failure log text changed from "Failed to enqueue push notification job" to "Failed to queue push notification job" (no test depended on it).

---

### T-010 — review — 2026-10-09T12:00:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed the shared entry service used by the app API and v1 plus the OpenAPI drift fixes; verified with real SQL (integration 46/46 serially) and a manual v1 run covering create, rename, toggle, delete, 403/404/400 paths and push/SSE side effects. |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

### T-010 — implement — 2026-10-09T12:00:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Committed T-010 after review PASS_WITH_NOTES: shared entry service for the app API and v1, OpenAPI drift fixed. |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md, plus all T-010 implementation files |
| Commit | `feat(api): make Home Assistant item changes record the actor, honour list limits and notify like the app` |
| Next Role | none |

---

### T-011 — implement — 2026-10-09T13:30:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Adds query indexes (incl. a trigram GIN index) with an explicit pg_trgm, configurable pool limits and timeouts, and `GET /api/lists/:id` with a cached `fetchList` helper. |
| Files Changed | backend/src/db/migrations/1779979000004_add_query_indexes.cjs, backend/src/db/migrations.test.js, backend/src/db/client.js, backend/src/db/client.test.js, backend/src/env.js, backend/src/routes/lists.js, backend/src/lists.test.js, backend/src/integration/helpers.js, backend/src/integration/indexes.test.js, frontend/src/api/lists.ts, frontend/src/api/lists.test.ts, frontend/src/types.ts, .env.example, docker-compose.example.yml, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | `npm run lint` 0 errors (1 pre-existing warning); `npm run build` ok; `npm test` backend 357/357, frontend 677/677. `integration/indexes.test.js` and the migration round-trip including the new migration NOT executed locally (no PostgreSQL, Docker daemon not running); CI runs them. |
| Commit | `perf(db): index the hot queries, bound the connection pool and add a single-list endpoint` |
| Next Role | review |

Notes for review:
1. **Migration `1779979000004_add_query_indexes`:** `CREATE EXTENSION IF NOT EXISTS pg_trgm`; indexes `entries(list_id,status,created_at)`, `entries(list_id,updated_at)`, `lists(owner_id)`, `list_members(user_id)`, `pending_push_jobs(fire_at)`, `push_subscriptions(endpoint)` (the existing unique key is `(user_id, endpoint)`, so a plain index was needed) and GIN `gin_trgm_ops` on `entries(text)`. `down` drops all of them and keeps the extension (as planned). Not run against PostgreSQL locally.
2. **Test harness:** `pg_trgm` joined `pgcrypto` in `SHARED_EXTENSIONS` (created once in `public`), because a per-schema extension would make `gin_trgm_ops` unresolvable for parallel test files. The older migration `1713902400000` still has `dropExtension("pg_trgm")` in its `down`; the harness' `migrate()` therefore turns `DROP EXTENSION` statements into no-ops so the round-trip test cannot break other files. Production migrations are unchanged.
3. **EXPLAIN test:** `indexes.test.js` records the SQL that the real endpoints (entries, history, suggestions, overview) run through a recording pool and `EXPLAIN`s exactly those statements on a seeded DB (41 lists, ~12k entries, ANALYZE), failing on any `Seq Scan` of `entries`. The suggestions query's `similarity(...) > 0.25` branch is not index-assisted by design; the `list_id` filter keeps it off a full scan.
4. **Pool:** `getPoolOptions(config)` → `max` from `PG_POOL_MAX` (default 10; invalid/zero/non-integer values fall back to 10), `connectionTimeoutMillis: 5000`, `idleTimeoutMillis: 30000`. Documented in README table, `.env.example` and the compose example.
5. **`GET /api/lists/:id`:** access check first (403 for strangers), then owner/meta query, shape `{ list: { id, name, owner_id, owner_name, is_owner, created_at } }`. Malformed ids → 404 via the existing `uuidParam`. Frontend: `fetchList(token, id, { onCachedValue })`, cache key `list:<id>` (`createListCacheKey`), and optional `owner_id`/`owner_name` on `List`. Nothing uses `fetchList` yet (T-016).

### T-011 — review — 2026-10-09T08:30:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed query indexes, pool settings and GET /api/lists/:id; unit-level criteria met, but the migration and EXPLAIN integration tests were not executed by implementer or reviewer (no PostgreSQL available). |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none (run `npm run test:integration` against PostgreSQL before commit_task) |
| Next Role | implement |

---

### T-011 — implement — 2026-10-09T06:53:19Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Committed T-011 after review PASS_WITH_NOTES: query indexes with explicit pg_trgm, bounded pool settings and a single-list endpoint. The PostgreSQL integration suite (new indexes test and migration round-trip) could not be run before the commit because Docker Desktop was not running; CI is the first real run. |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md, plus all T-011 implementation files |
| Commit | `perf(db): index the hot queries, bound the connection pool and add a single-list endpoint` |
| Next Role | none |

---

### T-012 — implement — 2026-10-09T09:10:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | A removed or leaving member now receives `member:removed` directly, `list:deleted` is sent after a successful delete to recipients read beforehand and can no longer block it, and the detail page leaves with a translated notice or renames in place while the overview drops the list. |
| Files Changed | backend/src/sseManager.js, backend/src/routes/sharing.js, backend/src/routes/lists.js, backend/src/lists.test.js, backend/src/sharing.test.js, backend/src/listLifecycleEvents.test.js, frontend/src/pages/ListDetailPage/ListDetailPage.tsx, frontend/src/pages/ListDetailPage/useListLifecycleEvents.ts, frontend/src/pages/ListDetailPage.test.tsx, frontend/src/pages/OverviewPage/OverviewPage.tsx, frontend/src/pages/OverviewPage/OverviewPage.test.tsx, frontend/src/locales/en/translation.json, frontend/src/locales/de/translation.json, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | `npm run lint` (0 errors, 1 pre-existing warning); `npm run build` ok; `npm test` backend 365/365, frontend 687/687 pass. No SQL changed, so no integration run; Docker/PostgreSQL was not available this session anyway. |
| Commit | `fix(sharing): tell removed members and everyone on a deleted list so their pages leave it` |
| Next Role | review |

Notes for review:
1. **Root cause:** `broadcastToList` queries the *remaining* recipients after the membership delete, so the removed or leaving user was never in the result. The routes now also call `sseManager.sendToUsers([userId], "member:removed", …)` directly; the remaining owner/members still get the list broadcast. New `SseManager.getListRecipients(pool, listId)` (the old query, now shared by `broadcastToList`).
2. **List delete order:** recipients are read first, the `DELETE` runs, then `list:deleted` is sent synchronously via `sendToUsers`; both the lookup and the send are try/caught and logged, so neither blocks the delete (previously the broadcast was awaited before the delete, so a rejection returned 500 and announced a deletion that had not happened).
3. **Detail page:** the three handlers live in the new `useListLifecycleEvents` hook (the page is capped below 400 lines by an existing structure test, which I kept as is). Own removal / `list:deleted` navigate to `/` with `state.notice` (translated at the moment of navigation); `list:updated` calls the existing `fetchList` (T-011) and merges the result into `list`, leaving entries untouched; a failed refresh keeps the title and logs.
4. **Overview:** drops lists on `list:deleted` (still refetches, as the existing app test expects) and on `member:removed` for the current user (no refetch); shows `state.notice` once in a `role=status` banner and clears the router state on mount.
5. **Existing tests changed because behaviour changed:** the sharing/lists spies gained `sendToUsers`/`getListRecipients`; the list-delete test no longer expects the broadcast before the DELETE; revoke/leave tests additionally expect the direct send; `ListDetailPage.test.tsx`/`OverviewPage.test.tsx` mocks gained `user.id`, `fetchList` and a landing probe for the notice.
6. A user who leaves voluntarily is also sent `member:removed`; their own page already navigated away, so only their other tabs show the "removed" notice.

---

### T-012 — review — 2026-10-09T09:10:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed membership and list lifecycle events: removed/leaving members now receive member:removed, list delete is not blocked by broadcast failures, detail page and overview react; all criteria met. |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

---

### T-012 — implement — 2026-10-09T07:04:16Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Committed T-012 after review PASS_WITH_NOTES: removed and leaving members and everyone on a deleted list now receive the lifecycle events, and the detail page and overview react. |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md, plus all T-012 implementation files |
| Commit | `fix(sharing): tell removed members and everyone on a deleted list so their pages leave it` |
| Next Role | none |

---

### T-013 — implement — 2026-10-09T07:12:43Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Entry events now carry the entry (and actor / deleted status) and the detail page patches its entries from them idempotently instead of refetching, reloading the history only on done transitions and debounced; resync and payload-less events still refetch. |
| Files Changed | backend/src/services/entryService.js, backend/src/entries.test.js, backend/src/v1.test.js, frontend/src/pages/ListDetailPage/listDetailUtils.ts, frontend/src/pages/ListDetailPage/listDetailUtils.test.ts, frontend/src/pages/ListDetailPage/useListDetailData.ts, frontend/src/pages/ListDetailPage/ListDetailPage.tsx, frontend/src/pages/ListDetailPage.test.tsx, frontend/src/context/EventSourceContext.tsx, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | `npm run lint` (0 errors, 1 pre-existing warning); `npm run build` ok; `npm test` backend 365/365, frontend 719/719 pass. `tsc --noEmit` shows only the two pre-existing errors (T-021). PostgreSQL integration not run (Docker Desktop off); the only SQL change is `DELETE … RETURNING id, status`. |
| Commit | `perf(sse): patch live entry changes from the event payload instead of refetching the list` |
| Next Role | review |

Notes for review:
1. **Payloads** (both app API and v1, since both go through `entryService`): `entry:created`/`entry:updated` = `{ listId, entryId, actorId, entry }` where `entry` is the `RETURNING` row (same columns as the entries GET without `is_changed`); `entry:deleted` = `{ listId, entryId, actorId, entryStatus }` via `DELETE … RETURNING id, status`. Existing fields are kept for compatibility. The 11 backend assertions on these payloads were updated (entries.test.js, v1.test.js).
2. **`applyEntryEvent`** (pure, in `listDetailUtils.ts`, 29 unit tests): upsert/remove by id, same array reference when nothing changes (idempotent, so the actor's own event is a no-op on that tab), `is_changed = last_updated_by !== currentUserId` (kept `true` for entries completed on this client), queued (`is_pending_sync`) entries untouched, events about an entry with its own request still in flight are ignored (the response delivers the final state), result re-sorted. Returns `null` for unusable payloads → the hook refetches (old servers). `entry:deleted` without `entryStatus` also returns `null` because the history impact cannot be judged; this keeps the existing app test ("refetches entries and members … when SSE events arrive", payload-less events) unchanged.
3. **History reload:** `historyChanged` is true when an entry moves to or from done (or arrives done and unknown) or a done entry is deleted; the hook debounces with a trailing 250 ms timer (cleared on unmount) and passes the latest entries to `reloadHistory`. The standalone `history:updated` event still reloads immediately.
4. **Hook/page:** `useListDetailData` gets `currentUserId` and returns `handleEntryCreated/Updated/Deleted`; the patched entries are also written to the offline cache (`entries:<listId>`). `sortEntries` moved from the hook to `listDetailUtils.ts` (exported). The page shrank (the old `handleEntryChange` is gone), so the "< 400 lines" structure test is untouched.
5. **Known limitation:** when the server evicts the oldest done entry at the 200-done cap, other clients are not told about that deletion (as before for open lists, since only open entries render); the history refresh on the done transition covers the visible effect.
6. **Not run:** the Playwright specs and the PostgreSQL integration suite.

---

### T-013 — review — 2026-10-09T09:50:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed SSE entry events carrying the entry and actor, client-side idempotent patching and debounced history reload; all criteria met, two-client E2E not available yet. |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

---

### T-013 — implement — 2026-10-09T07:16:18Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Committed T-013 after review PASS_WITH_NOTES: entry events carry the entry and actor, and the detail page patches live changes idempotently instead of refetching. |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md, plus all T-013 implementation files |
| Commit | `perf(sse): patch live entry changes from the event payload instead of refetching the list` |
| Next Role | none |

---
