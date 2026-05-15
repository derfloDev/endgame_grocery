# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-15

#### Findings

No blocking or major issues found.

- **nit** · `backend/src/db/migrations/1778803200000_add_api_key_to_users.cjs` line 1  
  `const shorthands = undefined;` is a no-op boilerplate. Harmless; consistent with existing migrations.

#### Verification

##### Steps
1. Read migration file `1778803200000_add_api_key_to_users.cjs` — correct `addColumns`/`dropColumns` structure, UUID type, unique constraint, nullable (no `notNull` flag).
2. Read updated `backend/src/db/migrations.test.js` — new test case asserts both `up` and `down` paths via the pgm spy, matching expected call signatures.
3. Ran `node --test src/db/migrations.test.js` in `backend/` — **9/9 pass**, including the new `api_key` test.
4. Ran `npm run lint` — 0 errors (1 pre-existing warning in frontend, unrelated to T-001).
5. Ran `npm run build` — clean build for both frontend and backend.
6. Ran `npm test` — **107/107 pass** across all workspaces.
7. Inspected `git diff` — exactly two files changed: migration file (new) and test file (extended). No unintended side-effects.

##### Findings
- All automated checks green.
- Migration schema matches plan exactly: `api_key` is `uuid`, `unique: true`, nullable (no `notNull: true`), no default value.
- Down migration correctly drops only the `api_key` column.

##### Risks
- None. Migration is additive and fully reversible.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-15

#### Findings

No blocking or major issues found.

- **nit** · `backend/src/routes/auth.js` lines 465–522  
  Both new routes include a `!pool` guard consistent with the existing pattern. No issue — just noting the style is uniform.

- **nit** · `backend/src/auth.test.js` — "regenerates an API key" test  
  The test verifies that two successive POSTs produce different keys and the second key is returned correctly, but does not explicitly assert that the old key would be rejected by the middleware. This is acceptable: the query mock returns `{ api_key: params[0] }`, so the DB always holds the latest key, and the middleware's separate unit tests cover rejection of unknown keys. Combined coverage is sufficient.

#### Verification

##### Steps
1. Read `backend/src/routes/auth.js` — two new routes (`GET /api-key`, `POST /api-key`) at lines 465–522, both gated by `requireAuth`. SQL queries and response shapes match the plan exactly.
2. Read `backend/src/middleware/auth.js` — `createRequireApiKey` exported at lines 30–67. Checks `x-api-key` header, queries `SELECT id FROM users WHERE api_key = $1 LIMIT 1`, sets `req.user = { sub: user.id }`, wraps DB error via `next(error)`. Matches plan spec exactly.
3. Read `backend/src/auth.test.js` — 7 new tests added (4 route tests + 3 middleware unit tests). All required test scenarios from the plan covered.
4. Read `README.md` diff — one-liner added documenting the new API-key endpoints. Documentation rule satisfied.
5. Ran `node --test src/auth.test.js` in `backend/` — **27/27 pass** (22 auth routes + 2 requireAuth + 3 requireApiKey).
6. Ran `npm run lint` — 0 errors (1 pre-existing React fast-refresh warning, unrelated).
7. Ran `npm run build` — clean.
8. Ran `npm test` — **114/114 pass** (107 baseline + 7 new tests).
9. Inspected `git diff` — 4 files changed: `routes/auth.js`, `middleware/auth.js`, `auth.test.js`, `README.md`. No unintended side-effects.

##### Findings
- All plan acceptance criteria verified: `GET` returns `{ api_key: null | string }`, `POST` generates/replaces key, middleware accepts valid keys and rejects missing/invalid ones with 401.
- `generateApiKey` is injectable, consistent with codebase patterns for testability.
- Documentation updated in `README.md` per AGENTS.md documentation rule.

##### Risks
- None. Routes are additive; middleware is a new export with no changes to existing exports.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-003

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-15

#### Findings

No blocking or major issues found.

- **minor** · `backend/src/v1.test.js` — toggle test only covers `open→done`; the `done→open` branch is not exercised. The implementation logic is trivially symmetrical (`!== "done" ? "done" : "open"`), so the behaviour is correct. Not a required fix but worth noting.

- **nit** · `backend/src/routes/v1.js` line 107 — `!name?.trim()` correctly rejects both missing and whitespace-only names; `name.trim()` is also applied on INSERT. Bonus robustness beyond the plan's `{ name: string }` requirement.

- **nit** · `backend/src/app.js` — `pool` is now explicitly extracted from `options` at the top of `createApp` and forwarded in `routerOptions`. Sensible refactor (single source of truth for the pool reference), no regressions.

- **nit** · Plan mentioned a `toDbStatus` helper; it was correctly omitted since no endpoint accepts a HA-format status as input — toggle only reads and flips the DB value.

#### Verification

##### Steps
1. Read `backend/src/routes/v1.js` — all 5 endpoints present; `ensureListAccess` used on every list-scoped route; status mapping (`toHaStatus`, `serializeItem`) matches plan; `createV1Router` signature accepts `{ pool, requireApiKey }` with pool-level fallback.
2. Read `backend/src/v1.test.js` — 18 tests covering: 5× missing-key 401, 1× real-middleware unknown-key 401, 4× foreign-list 403, GET lists shape, GET items with HA status mapping, POST 400 no-name, POST 201 create with trim, toggle open→done + 404, DELETE 204 + 404.
3. Read `backend/src/app.js` diff — `v1Routes` registered under `/api/v1`; `requireApiKey` created once from extracted `pool` and forwarded via `routerOptions`; no regressions to existing routes.
4. Read `README.md` diff — one-liner documenting all 5 v1 endpoints and HA status values.
5. Ran `node --test src/v1.test.js` in `backend/` — **18/18 pass**.
6. Ran `npm run lint` — 0 errors (1 pre-existing frontend warning).
7. Ran `npm run build` — clean.
8. Ran `npm test` — **132/132 pass** (114 baseline + 18 new).

##### Findings
- All plan acceptance criteria met: 5 endpoints under `/api/v1/`, correct status mapping, 401/403/404 error handling.
- `app.js` pool refactor is safe — extracted value is identical to what each router would have resolved from `getPool()`.

##### Risks
- None. Toggle done→open path is correct by inspection even without an explicit test.

#### Open Questions
- None.

#### Verdict
`PASS`
