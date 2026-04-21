# REVIEW

---

## T-005 — Entry Management

**Verdict: PASS**

### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `backend/src/routes/entries.js:52` | `ORDER BY status ASC, created_at ASC` returns "done" entries before "open" entries because "done" < "open" alphabetically. The plan comment says "(open first)". No functional impact — the frontend splits entries by status client-side and the `sortEntries` helper always places open items first regardless of server ordering. | No |

### Verification

#### Steps performed
1. Read `.ai/PLAN.md` Phase 5 scope and T-005 acceptance criteria.
2. Inspected `backend/src/routes/entries.js`:
   - `createEntryRouter` uses `Router({ mergeParams: true })` to access `req.params.id` from the parent route ✅
   - `ensureListAccess` checks both owner and member access before every operation ✅
   - `GET /` returns entries ordered by status/created_at; membership enforced ✅
   - `POST /` inserts with `status = 'open'`, 201 response ✅
   - `PATCH /:entryId` validates status enum (`open`/`done`); uses `COALESCE` to allow partial updates (text-only or status-only); returns 404 if entry not found ✅
   - `DELETE /:entryId` returns 404 if entry not found, 204 on success ✅
3. Inspected `backend/src/app.js` — entries mounted at correct path `/api/lists/:id/entries` (previously stubbed at wrong path) ✅
4. Inspected `frontend/src/api/entries.js` — all four functions include `Authorization: Bearer` header; 204 handled ✅
5. Inspected `frontend/src/pages/ListDetailPage.jsx`:
   - `inputRef` assigned to text field; `inputRef.current?.focus()` called after successful entry creation — Enter-key refocus ✅
   - Two sections: "Open items" (top) and "Done items" (bottom) ✅
   - `sortEntries` helper: open first, then by `created_at` ASC; called after every mutation ✅
   - Toggle via `updateEntry` with flipped status; re-sorts after update ✅
   - Inline text edit with Enter-to-save ✅
   - Delete with optimistic local removal ✅
   - `isMounted` guard on initial load ✅
6. Inspected `app.test.jsx` — new end-to-end test covers: load entries, add via Enter key, toggle status, inline edit, delete.
7. Ran `npm run lint` — 1 warning (same non-blocking fast-refresh warning), exit 0 ✅
8. Ran `npm run build` — clean ✅
9. Ran `npm test` — 17/17 tests pass across 7 suites ✅

#### Findings
- All T-005 acceptance criteria satisfied:
  - CRUD endpoints enforce membership (owner or member via `ensureListAccess`) ✅
  - `ListDetailPage` shows open and done sections ✅
  - Enter-key input refocuses immediately (via `inputRef.current?.focus()`) ✅
  - Toggling status moves entry to correct section (client-side `sortEntries` + section filter) ✅
- No regressions to any prior tests.

#### Risks
- Low: Backend ordering note (finding #1) — no runtime impact.

---

---

## T-004 — List Management

**Verdict: PASS**

### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `backend/src/routes/lists.js:111,154` | `PATCH /:id` and `DELETE /:id` return 403 for both "list not found" and "caller is not the owner". A strict reading of the plan says "403 otherwise" (owner check), but returning 403 when the list genuinely doesn't exist is also acceptable here since it avoids leaking list existence to non-owners. No action required. | No |

### Verification

#### Steps performed
1. Read `.ai/PLAN.md` Phase 4 scope and T-004 acceptance criteria.
2. Inspected `backend/src/routes/lists.js` — all four endpoints (`GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`) implemented with correct auth middleware, SQL, and status codes.
3. Verified `GET /` SQL: joins `lists` + `users` (for `owner_name`) + LEFT JOIN `list_members` (filtered to caller), `WHERE owner_id = $1 OR lm.user_id = $1`; no duplicate rows because the left join filters to caller only ✅.
4. Verified `POST /` inserts with `owner_id = req.user.sub`, returns 201 + `is_owner: true` ✅.
5. Verified `PATCH /:id` ownership check before update, 403 on failure, no separate 404 (acceptable, avoids list-existence leak) ✅.
6. Verified `DELETE /:id` uses same ownership check, `DELETE FROM lists` triggers DB cascades for entries and members ✅.
7. Inspected `backend/src/app.js` — lists router wired via factory pattern `listRoutes(options)`, consistent with auth ✅.
8. Inspected `frontend/src/api/lists.js` — `fetchLists`, `createList`, `renameList`, `deleteList` all set `Authorization: Bearer <token>` header and handle 204 response ✅.
9. Inspected `OverviewPage.jsx` — loads lists on mount; isMounted guard prevents state updates after unmount; create/rename/delete flows with optimistic local-state update; shared indicator pill with "Shared by {owner_name}" for `is_owner: false`; confirmation dialog before delete ✅.
10. Inspected `app.test.jsx` — existing login/register tests updated to mock the subsequent `GET /api/lists` call; new end-to-end test covers create, rename (keyboard Enter + Save button), and delete ✅.
11. Ran `npm run lint` — 1 warning (same non-blocking fast-refresh warning), exit 0 ✅.
12. Ran `npm run build` — clean ✅.
13. Ran `npm test` — 13/13 tests pass across 6 suites ✅.

#### Findings
- All T-004 acceptance criteria satisfied:
  - CRUD endpoints return correct data and enforce owner-only rules ✅
  - OverviewPage lists all accessible lists with shared indicator ✅
  - Create/rename/delete flows work end-to-end ✅
- No regressions to previously-passing auth tests.

#### Risks
- Low: `PATCH`/`DELETE` return 403 on both "not found" and "not owner"; acceptable trade-off already noted above.

---

---

## T-003 — Authentication (rework round 2)

**Verdict: PASS**

### Summary of rework
The required fix is correctly applied:
- **Finding #1 (major)** — `backend/src/app.js:21` now declares `(error, _req, res, _next)` with 4 parameters. Express will correctly route unhandled errors to this handler. `void _next` silences the no-unused-vars linting rule cleanly. ✅
- ESLint config gained `"react/prop-types": "off"` — valid quality-of-life addition for a TypeScript-free project, no impact on correctness.

No regressions. All previously-passing tests continue to pass.

### Verification

#### Steps performed
1. Re-read `.ai/REVIEW.md` round-1 required fix as a checklist.
2. Inspected `backend/src/app.js` — error handler now has 4 parameters ✅.
3. Confirmed `backend/src/routes/auth.js` and `backend/src/middleware/auth.js` unchanged.
4. Confirmed `eslint.config.js` change (`react/prop-types: off`) is benign.
5. Ran `npm run lint` — 1 warning (same non-blocking fast-refresh warning as before), exit 0 ✅.
6. Ran `npm run build` — clean ✅.
7. Ran `npm test` — 8/8 tests pass across 5 suites ✅.

#### Risks
None beyond the previously-noted nit (fast-refresh warning in `AuthContext.jsx`).

---

## T-003 — Authentication (round 1)

**Verdict: FAIL**

### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | major | `backend/src/app.js:21` | **Express error handler has 3 parameters instead of 4 — it will never fire.** Express identifies error-handling middleware by a function's declared argument count. A function `(error, _req, res) => {}` has `length === 3` so Express treats it as a regular request handler, not an error handler. When any route calls `next(error)` (e.g. DB down, unhandled exception), the handler is bypassed and Express falls through to its default handler, which may expose stack traces in production. The fix is to add the `next` parameter: `(error, _req, res, _next) => {}`. | Yes |
| 2 | nit | `frontend/src/context/AuthContext.jsx:77` | `useAuth` is exported alongside `AuthProvider` from the same file, triggering the `react-refresh/only-export-components` warning. Not a blocker (rule set to `warn`; lint exits 0), but splitting the hook into a separate file would silence it cleanly. | No |

### Required Fixes

1. **(major)** Add a fourth `_next` parameter to the error handler in `backend/src/app.js` so Express recognises it as an error-handling middleware:
   ```js
   app.use((error, _req, res, _next) => {
     console.error(error);
     res.status(500).json({ error: "Internal server error." });
   });
   ```

### Verification

#### Steps performed
1. Read `.ai/PLAN.md` Phase 3 scope and T-003 acceptance criteria.
2. Inspected all new/changed files: `backend/src/routes/auth.js`, `backend/src/middleware/auth.js`, `backend/src/app.js`, `backend/src/env.js`, `backend/src/auth.test.js`, `frontend/src/api/auth.js`, `frontend/src/context/AuthContext.jsx`, `frontend/src/components/ProtectedRoute.jsx`, `frontend/src/pages/LoginPage.jsx`, `frontend/src/pages/RegisterPage.jsx`, `frontend/src/App.jsx`, `frontend/src/main.jsx`, `frontend/src/app.test.jsx`, `frontend/package.json`.
3. Verified T-001 carry-forward fix: `requireAuth` no longer calls `next()` after response — correct factory pattern used ✅.
4. Cross-checked backend auth routes against plan: `POST /api/auth/register` → 201 + user object ✅; 400 on missing fields ✅; 409 on duplicate email (pg error code 23505) ✅. `POST /api/auth/login` → 200 + JWT ✅; 401 on unknown email ✅; 401 on wrong password ✅.
5. Checked JWT payload uses `{ sub: userId }` ✅; `jwtExpiresIn` added to `getConfig()` ✅; email normalised to lowercase on insert and lookup ✅.
6. Reviewed `AuthContext`: token in localStorage, `user`, `login()`, `logout()`, `register()` all exposed ✅. `register()` auto-logs in after successful registration ✅. `parseJwtSubject` decodes `sub` from token client-side ✅.
7. Verified `ProtectedRoute` redirects to `/login` with `state.from` for post-login redirect ✅.
8. Verified React Router routes: `/login`, `/register`, `/`, `/lists/:id` ✅. Wildcard `*` → `/` ✅.
9. Inspected `app.js` error handler — 3 parameters, will never be called as error handler (finding #1).
10. Ran `npm run lint` — 1 warning (non-blocking, pre-noted in evidence), exit 0.
11. Ran `npm run build` — clean.
12. Ran `npm test` — 8 tests across 5 suites, all pass (3 frontend auth shell tests, 4 backend auth/middleware tests, 1 getConfig, 1 migration export, 2 seed data).

#### Findings
- All acceptance criteria are met at the functional level (register/login endpoints, JWT middleware, LoginPage/RegisterPage render and submit, ProtectedRoute redirect).
- The broken error handler (finding #1) is a latent production risk: `next(error)` calls in auth routes — DB down, pool null, unexpected exceptions — will bypass the intended handler and expose Express's default error response. Must be fixed before shipping.

#### Risks
- **Medium**: Without the error handler, unhandled backend errors could expose stack traces or response inconsistency in production.
- **Low**: The fast-refresh warning in `AuthContext.jsx` has no runtime impact.

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
