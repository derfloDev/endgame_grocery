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
