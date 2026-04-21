# REVIEW

---

## T-002 — Database Schema & Migrations (rework round 2)

**Verdict: PASS**

### Summary of rework
Both required fixes from round 1 are correctly addressed:
- **Finding #1 (major)** — `seed.js` now calls `await pool.end()` directly on the locally-held `Pool` instance (line 78). The module-level singleton is no longer involved; the pool that was opened is the same one that gets closed. Process will exit cleanly.
- **Finding #2 (minor)** — `node-pg-migrate` moved from `devDependencies` to `dependencies` in `backend/package.json`. ✅

No new issues introduced.

### Verification

#### Steps performed
1. Re-read `.ai/REVIEW.md` round-1 findings as a checklist.
2. Inspected reworked `backend/src/db/seed.js` — `finally` block now calls `await pool.end()` (line 78) instead of `closePool()`. Confirmed the local `pool` reference and the closed pool are the same object.
3. Inspected `backend/package.json` — `node-pg-migrate@^7.9.1` now appears under `dependencies`, not `devDependencies`. `nodemon` remains as the sole `devDependency`.
4. Ran `npm run lint` — clean.
5. Ran `npm run build` — passed (Vite + node --check).
6. Ran `npm test` — 4 tests, all pass.

#### Findings
- All T-002 acceptance criteria satisfied.
- Schema, constraints, and FK cascade behaviour unchanged and correct.
- Seed pool lifecycle fixed; no new regressions.

#### Risks
- `npm run migrate` and `npm run db:seed` remain unverifiable without a live PostgreSQL instance, consistent with the environment limitation noted in the implementer evidence.

---

## T-002 — Database Schema & Migrations (round 1)

**Verdict: FAIL**

### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | major | `backend/src/db/seed.js:7,78` | **Pool leak — seed script will hang.** `seedDatabase()` calls `createPool()` which returns a new `Pool` instance into a *local* variable; this pool is never assigned to the module-level `pool` in `client.js`. The `finally` block then calls `closePool()`, which checks the module-level `pool` (still `undefined`), returns early, and does nothing. The locally-created Pool is never closed. Node.js keeps the process alive because of the open connections, so `npm run db:seed` hangs indefinitely after inserting data. | Yes — call `pool.end()` directly on the locally-held instance, or switch to `getPool()` + `closePool()` so both sides share the same singleton. |
| 2 | minor | `backend/package.json:22` | `node-pg-migrate` is listed under `devDependencies`. The `npm run migrate` script invokes `node-pg-migrate` at runtime, so if dependencies are installed without dev packages (`npm ci --omit=dev`, typical in production or CI release stages), the migrate command will fail with "command not found". Should be in `dependencies`. | Yes — move to `dependencies`. |
| 3 | nit | `backend/src/db/migrations/1713895200000_create_core_tables.js:117` | The `down()` function does not drop the `pgcrypto` extension that `up()` creates. A complete reversible migration should clean up everything it creates. Low risk for this project, but worth noting. | No — cosmetic. |

### Required Fixes

1. **(major)** Fix the pool leak in `seed.js`: the pool returned by `createPool()` must be explicitly closed after use. Simplest fix — store the pool reference in a local `const` and call `localPool.end()` in the `finally` block instead of calling `closePool()`. Alternatively, refactor to use `getPool()` so that `closePool()` can find and close the shared singleton.
2. **(minor)** Move `node-pg-migrate` from `devDependencies` to `dependencies` in `backend/package.json`.

### Verification

#### Steps performed
1. Read `.ai/PLAN.md` Phase 2 scope and T-002 acceptance criteria.
2. Inspected all delivered files: `backend/package.json`, `backend/src/db/client.js`, `backend/src/db/migrations/1713895200000_create_core_tables.js`, `backend/src/db/seed.js`, `backend/src/db/seed-data.js`, `backend/src/db/migrations.test.js`, `backend/src/db/seed-data.test.js`, root `package.json` (migrate/db:seed root scripts).
3. Cross-checked migration schema against plan data model — all four tables, column types, constraints, and FK references match exactly.
4. Ran `npm run lint` — clean.
5. Ran `npm run build` — passed.
6. Ran `npm test` — 4 tests across 3 suites, all pass (migrations export check, seed data constants, getConfig fallback).
7. Reviewed `npm run migrate` / `npm run db:seed` — live DB unavailable (localhost:5432 not running); outcome consistent with implementer's evidence log.

#### Findings
- Migration file is complete and correct: all four tables (`users`, `lists`, `list_members`, `entries`) with correct columns, types, FK constraints (CASCADE), composite PK on `list_members`, and `CHECK (status IN ('open', 'done'))` on `entries`.
- `down()` correctly drops all four tables (in reverse dependency order).
- Root `package.json` gained `migrate` and `db:seed` proxy scripts that delegate to the backend workspace — correct.
- Pool lifecycle in `seed.js` is broken (finding #1): `createPool()` returns a new `Pool` that bypasses the module-level singleton; `closePool()` never reaches it; the process cannot exit.
- `node-pg-migrate` placement in `devDependencies` (finding #2) will break production/CI install workflows.

#### Risks
- **High**: The pool leak (finding #1) means `npm run db:seed` blocks indefinitely. Even if the data is written correctly, the process will need to be killed manually — this is a broken workflow.
- **Low**: `node-pg-migrate` dev-dep placement (finding #2) will silently break migrate commands in any environment that skips dev deps.

---

## T-001 — Project Scaffold

**Verdict: PASS_WITH_NOTES**

### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | minor | `backend/src/middleware/auth.js:3` | Stub `requireAuth` calls both `res.status(501).json(…)` and `next()`. Calling `next()` after a response is already sent will trigger a "headers already sent" error the moment any route applies this middleware. The `next()` call must be removed (or guarded) before T-003 wires auth middleware to any route. | Yes — fix in T-003 before middleware is applied to routes |
| 2 | nit | `backend/src/app.js:17-18` | Stub routes are mounted at `/api/entries` and `/api/sharing`. The plan specifies these as nested under `/api/lists` (`/api/lists/:id/entries`, `/api/lists/:id/members`). Stubs return 501 today so there is no functional impact, but the mount paths do not match the final API surface. T-004/T-005/T-006 implementers should update (or remove) these mounts. | No — cosmetic, addressed during feature tasks |

### Required Fixes

1. **(minor, T-003 pre-condition)** Remove or guard the `next()` call in `backend/src/middleware/auth.js` so the stub does not attempt to forward after sending a response.

### Verification

#### Steps performed
1. Read `.ai/PLAN.md` Phase 1 scope and acceptance criteria.
2. Inspected all delivered files: `package.json` (root, frontend, backend), `docker-compose.yml`, `.env.example`, `eslint.config.js`, `.prettierrc.json`, `vite.config.js`, `frontend/src/`, `backend/src/` (index, app, env, db/client, routes/*, middleware/auth).
3. Ran `npm run lint` — clean exit, no warnings.
4. Ran `npm run build` — Vite frontend build succeeded (30 modules); backend `node --check` syntax check passed.
5. Ran `npm test` — frontend Vitest (1 test, pass); backend `node --test` (1 test, pass).

#### Findings
- All T-001 acceptance criteria are satisfied:
  - npm workspaces (`frontend`, `backend`) correctly declared at root.
  - Root scripts `dev`, `build`, `lint`, `test` all present and functional.
  - `docker-compose.yml`: `postgres:16`, named volume `postgres_data`, correct env vars.
  - `.env.example` contains `DATABASE_URL`, `JWT_SECRET`, `PORT`.
  - `vite-plugin-pwa` listed as a frontend devDependency (configuration intentionally deferred to T-007 per plan).
  - Backend dependencies: Express, pg, dotenv, bcrypt, jsonwebtoken, nodemon — all present.
  - All stub routes return `501 Not Implemented` cleanly.
- The `requireAuth` middleware stub has a logic error (finding #1 above) that is safe today but will cause a runtime fault the moment T-003 attaches it to any route.

#### Risks
- **Low**: The auth middleware bug (finding #1) is latent. It will surface immediately when T-003 applies `requireAuth` to any route, but it will not affect any other task before that point.
- **Low**: Stub route mount paths (finding #2) differ from the final API spec. No functional risk until feature tasks reuse or extend these mounts.
