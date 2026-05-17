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

---

## Task: T-004

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-15

#### Findings

No blocking or major issues found.

- **nit** · `backend/src/routes/docs.js` lines 19–20 — `router.get('/', swaggerUi.setup(spec))` is registered before `router.use('/', swaggerUi.serve)`, reversing the order shown in the plan example. Functionally correct because `router.get('/')` matches only the root path and does not interfere with `router.use('/')` handling static asset sub-paths. Tests pass; no rework required.

- **nit** · `backend/src/routes/docs.js` line 12 — `createDocsRouter()` accepts no parameters but is called as `docsRoutes(routerOptions)` in `app.js`. The extra argument is silently ignored. Harmless; consistent with the factory pattern of other routers.

#### Verification

##### Steps
1. Read `backend/src/openapi/v1.yaml` — OpenAPI 3.1.0 with correct `info`, `servers: [{ url: /api/v1 }]`, global `security: [{ ApiKeyAuth: [] }]`, `ApiKeyAuth` scheme (`apiKey`, `header`, `X-Api-Key`). All 5 endpoints documented with request bodies, response schemas, and correct 401/403/404 error responses. `Item.status` enum matches HA values (`needs_action`, `completed`). `Error` schema used for all error responses.
2. Read `backend/src/routes/docs.js` — `GET /openapi.yaml` sets `Content-Type: application/yaml` and sends the file via `res.sendFile`; Swagger UI served via `swaggerUi.setup(spec)` + `swaggerUi.serve`. Both acceptance criteria served.
3. Read `backend/src/docs.test.js` — 2 tests: `GET /api/docs` checks status 200, content-type `text/html`, body matches `/Swagger UI/i`; `GET /api/docs/openapi.yaml` checks status 200, content-type `application/yaml`, verifies all 4 path keys and 401/403/404 response codes present in YAML.
4. Confirmed `backend/package.json` diff adds `js-yaml` and `swagger-ui-express` dependencies.
5. Confirmed `app.js` registers `docsRoutes` at `/api/docs`.
6. Confirmed `README.md` adds one-liner documenting Swagger UI and raw YAML endpoints.
7. Ran `node --test src/docs.test.js` in `backend/` — **2/2 pass**.
8. Ran `npm run lint` — 0 errors.
9. Ran `npm test` — **134/134 pass** (132 baseline + 2 new).

##### Findings
- Both acceptance criteria met: `GET /api/docs` → 200 HTML with Swagger UI; `GET /api/docs/openapi.yaml` → 200 `application/yaml`.
- Spec covers all 5 v1 endpoints with schemas and error responses; content is accurate relative to the implementation.

##### Risks
- None. The docs router is read-only and additive; no existing routes are affected.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-005

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-15

#### Findings

No blocking or major issues found. The implementation exceeds the plan's UX baseline in several good ways.

- **nit** · `frontend/src/components/InfoSheet/InfoSheet.tsx` line 24 — `apiKeyLoaded` state is an addition beyond the plan's three state variables. It is a positive enhancement that gates the "Generate key" button and shows a loading placeholder until the fetch resolves. No issue.

- **nit** · `InfoSheet.tsx` lines 35–56 — async fetch uses a `cancelled` flag for cleanup on unmount/re-open. This is correct and prevents set-state-after-unmount warnings. Not in the plan spec, good practice.

- **nit** · `InfoSheet.tsx` line 114 — `aria-live="polite"` on the "Copied!" feedback. Accessibility bonus not required by the plan. No issue.

- **nit** · Plan listed "Bestätigungs-Dialog oder direkt" for regeneration; implementation chose "direkt" (no confirmation dialog). This is within the plan's accepted range.

#### Verification

##### Steps
1. Read `frontend/src/api/auth.ts` — `fetchApiKey(token)` calls `GET /api/auth/api-key`; `regenerateApiKey(token)` calls `POST /api/auth/api-key`. Both typed correctly (`ApiKeyResult`, `{ api_key: string }`). ✅
2. Read `frontend/src/components/InfoSheet/InfoSheet.tsx` — API-key section rendered between user-identity and language-switcher as planned. Three required state vars present plus `apiKeyLoaded` UX bonus. `fetchApiKey` called on open via `useEffect([open, token])`. Copy calls `navigator.clipboard.writeText`. Regenerate calls `regenerateApiKey`, updates `apiKey` state. Cancel flag prevents stale-closure updates.  ✅
3. Read `InfoSheet.test.tsx` — 9 tests total (5 pre-existing + 4 new): fetch-on-open, show key + copy/regen buttons, empty state + generate button, clipboard write + "Copied!" feedback, regenerate updates displayed key. All 5 plan-required test scenarios covered. ✅
4. Read DE/EN locale files — all 7 plan-specified i18n keys present in both locales with correct text values. ✅
5. Read `InfoSheet.module.css` diff — new CSS classes for `.info-sheet-api-key`, `.info-sheet-api-key-header`, `.info-sheet-api-key-hint`, `.info-sheet-api-key-empty`, `.info-sheet-api-key-row`, `.info-sheet-api-key-value`, `.info-sheet-api-key-status`. Uses design tokens, monospace font for key display. ✅
6. Ran `npm run test --workspace frontend` — **407/407 pass** (28 test files).
7. Ran `npm run lint` — 0 errors (1 pre-existing frontend warning).
8. Ran `npm test` (full suite) — **134/134 backend pass**, **407/407 frontend pass**.
9. Confirmed README updated with API key management description (via HANDOFF evidence).

##### Findings
- All plan acceptance criteria met: InfoSheet shows API-key section; key can be generated, displayed (monospace), and copied; regenerating updates the displayed key; all 7 i18n keys present in DE and EN.
- Section placement (between user-identity and language-switcher) is correct.
- UX is better than the plan minimum: loading state, proper effect cleanup, and copy feedback timeout.

##### Risks
- None. Frontend-only change; no backend routes affected.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-006

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-15

#### Findings

No blocking or major issues found. All three plan fixes applied correctly.

- **nit** · `frontend/src/components/InfoSheet/InfoSheet.tsx` — `info-sheet-api-key-action` class applied only to Regenerate and Generate buttons, not to the Copy button. Copy sits in a two-column grid row alongside the key value, so full-width would break the layout there. Correct omission.

- **nit** · `frontend/src/styles/shared.test.ts` — The new regex spans the entire selector block with `/s` (dotAll). Robust enough; order of properties is hard-coded in the regex matching the implementation order. No issue.

#### Verification

##### Steps
1. Read `frontend/src/styles/shared.css` diff — exactly `display: inline-flex; align-items: center; justify-content: center; gap: 8px;` added to the combined button-class block (`.button-primary, .eg-btn, .eg-btn-primary, .button-secondary, .eg-btn-secondary, .eg-btn-ghost, .eg-btn-danger`). Matches plan spec precisely. ✅
2. Read `frontend/src/components/InfoSheet/InfoSheet.module.css` diff — four changes: (a) `.info-sheet-api-key` gap raised to `var(--space-3)` ✅; (b) `.info-sheet-api-key-hint` `margin-bottom: var(--space-1)` added ✅; (c) `.info-sheet-logout` redundant `display/align-items/justify-content/gap` removed ✅; (d) new `.info-sheet-api-key-action { width: 100% }` class ✅.
3. Read `frontend/src/components/InfoSheet/InfoSheet.tsx` diff — Regenerate button: `plus` → `refreshCw` + `info-sheet-api-key-action` class added ✅; Generate button: `plus` → `key` + `info-sheet-api-key-action` class added ✅.
4. Read `frontend/src/components/ui/Icon/Icon.tsx` diff — `key` (circle + 3 paths) and `refreshCw` (2 polylines + 2 paths) added to `iconPaths`. Standard Lucide icon paths. ✅
5. Read `frontend/src/components/ui/ui.test.tsx` diff — new test verifies `key` and `refreshCw` render 2 SVGs with ≥6 path/polyline elements (no fallback circle). ✅
6. Read `frontend/src/styles/shared.test.ts` diff — new test asserts all button classes include the `inline-flex` flex group via dotAll regex. ✅
7. Ran `npm run test --workspace frontend` — **409/409 pass** (407 baseline + 2 new: 1 in shared.test, 1 in ui.test).
8. Ran `npm run lint` — 0 errors (1 pre-existing frontend warning).
9. Ran `npm run build` — clean.
10. Ran `npm test` (full) — **134/134 backend pass**, **409/409 frontend pass**.

##### Findings
- All three plan fixes delivered: global button flex alignment, icon swap (plus→key, plus→refreshCw), CSS cleanup (gap, hint margin, redundant logout flex, full-width action buttons).
- No behavioral changes: no new i18n keys, no API changes, no logic delta. ✅
- Existing InfoSheet tests all pass without modification (icon names not asserted by name in those tests).

##### Risks
- None. CSS-only and icon-path changes; no logic affected.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-007

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-15

#### Findings

No blocking or major issues found. Both fixes are correct; the implementation is slightly more defensive than the plan's one-liner.

- **nit** · `backend/src/app.js` lines 78–84 — The plan specified a simple `app.get("/api/docs", (_req, res) => res.redirect(301, "/api/docs/"))`. The implementation adds an `if (req.path === "/api/docs") … else next()` guard. This is a sound defensive pattern: if Express's non-strict routing were to match `/api/docs/` with `app.get("/api/docs", ...)`, the guard prevents an infinite 301 redirect loop. The tests confirm the guard works correctly: `GET /api/docs` → 301, `GET /api/docs/` → 200.

- **nit** · `backend/src/routes/docs.js` — Two-line swap (`router.use("/", swaggerUi.serve)` before `router.get("/", swaggerUi.setup(spec))`). Exactly matches plan Fix 2 and is proven correct by the new asset-serving test.

#### Verification

##### Steps
1. Read `backend/src/app.js` diff — `app.get("/api/docs", ...)` redirect handler inserted immediately before `app.use("/api/docs", docsRoutes(...))`. Guard condition `req.path === "/api/docs"` correctly discriminates with-slash from without-slash requests and prevents infinite redirect. ✅
2. Read `backend/src/routes/docs.js` diff — `router.use("/", swaggerUi.serve)` moved above `router.get("/", swaggerUi.setup(spec))` as specified by the plan. ✅
3. Read `backend/src/docs.test.js` diff — test suite expanded from 2 → 4 tests: (a) `GET /api/docs` → 301, `Location: /api/docs/`; (b) `GET /api/docs/` → 200 HTML (replaces old `GET /api/docs` test); (c) `GET /api/docs/swagger-ui.css` + `GET /api/docs/swagger-ui-bundle.js` → 200 with correct content-types; (d) YAML test unchanged. ✅
4. Read `README.md` diff — one-liner updated to document trailing-slash behavior and the redirect. ✅
5. Ran `node --test src/docs.test.js` in `backend/` — **4/4 pass**. Server logs confirm: `GET /api/docs` → 301, `GET /api/docs/` → 200, CSS → 200, bundle JS → 200, YAML → 200. ✅
6. Ran `npm run lint` — 0 errors (1 pre-existing frontend warning).
7. Ran `npm test` (full suite) — **136/136 backend pass** (134 baseline + 2 new), **409/409 frontend pass** (unchanged).

##### Findings
- Both acceptance criteria met: `GET /api/docs` → 301 to `/api/docs/`; Swagger UI assets serve correctly under `/api/docs/`.
- Middleware order fix (`serve` before `setup`) is confirmed working by the new asset test.
- No regressions to any previously green test.

##### Risks
- None. Redirect is a server-side 301; browser bookmarks using `/api/docs` will be silently updated to `/api/docs/` by the browser.

#### Open Questions
- None.

#### Verdict
`PASS`

## Task: T-008

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-17

#### Findings

No blocking or major issues found. All changes are minimal, targeted, and correct.

- **nit** · `backend/src/routes/v1.js` — `toHaStatus()` helper removed, `serializeItem()` simplified to `status: row.status`. Cleaner than the original; no dead code left behind.

#### Verification

##### Steps
1. Read `backend/src/routes/v1.js` diff — `toHaStatus()` function removed entirely; `serializeItem()` now returns `status: row.status` (raw DB value). No other logic changed. ✅
2. Read `backend/src/openapi/v1.yaml` diff — `Item.status` enum changed from `[needs_action, completed]` to `[open, done]`. Both Items schemas (response body and toggle response) updated. ✅
3. Read `backend/src/v1.test.js` diff — All `needs_action` → `open` and `completed` → `done` assertion updates; test names updated to match. 18 tests cover all 5 endpoints, 401/403/404 error paths, and owner/member access. ✅
4. Read `backend/src/docs.test.js` diff — YAML content test extended with `assert.match(..., /- open/)`, `assert.match(..., /- done/)`, `assert.doesNotMatch(..., /needs_action/)`, `assert.doesNotMatch(..., /completed/)`. ✅
5. Read `backend/src/openapi/v1.yaml` — Confirmed no remaining `needs_action` or `completed` references anywhere in the file. ✅
6. Read `README.md` and `ROADMAP.md` diffs — Documentation updated to reflect raw `open`/`done` status values instead of HA status mapping. ✅
7. Ran `node --test src/v1.test.js src/docs.test.js` in `backend/` — **22/22 pass** (18 v1 + 4 docs). ✅
8. Ran `npm run lint` — 0 errors (1 pre-existing frontend fast-refresh warning). ✅
9. Ran `npm run build` — clean, no new warnings. ✅
10. Ran `npm test` (full suite) — **136/136 backend pass**, **409/409 frontend pass** (1 pre-existing flaky timing test passed on re-run; unrelated to T-008). ✅

##### Findings
- All acceptance criteria met: v1 item responses return `open`/`done`; OpenAPI spec enum updated; no HA mapping references remain; all tests green.
- No regressions to any previously green test.

##### Risks
- Breaking change for any existing consumer expecting `needs_action`/`completed` — intentional and documented. No compatibility shim needed (no external consumers existed at the time of change).

#### Open Questions
- None.

#### Verdict
`PASS`

## Task: T-009

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-17

#### Findings

No blocking or major issues found. Implementation is clean and minimal.

- **nit** · `backend/src/routes/v1.js` — `isValidUuid()` guards precede the `!pool` null-check in each route. Functionally correct (early exit avoids DB work) and a reasonable ordering; the plan does not specify guard ordering relative to the pool check.

- **nit** · `backend/src/v1.test.js` — Existing non-UUID path parameters (`list-1`, `item-1`, `list-foreign`, etc.) replaced with proper UUID constants (`LIST_ID`, `ITEM_ID`, etc.). This is a welcome clean-up: prior tests were technically testing behaviour with invalid IDs — now all baseline tests use correctly-formatted UUIDs, which better reflects real usage. No test coverage was lost.

#### Verification

##### Steps
1. Read `backend/src/routes/v1.js` diff — `UUID_RE` regex (`/^[0-9a-f]{8}-...$/i`) and `isValidUuid()` helper match the plan exactly. Guards inserted before any DB access in all four parameterised routes: `GET /lists/:listId/items`, `POST /lists/:listId/items`, `POST /lists/:listId/items/:itemId/toggle`, `DELETE /lists/:listId/items/:itemId`. ✅
2. Read `backend/src/v1.test.js` diff — Six named UUID constants defined at top; four new tests cover the plan's exact scenarios: `{listId}` on GET/POST list-items → 404, `{itemId}` on toggle → 404, `not-a-uuid` on delete → 404. `createUnexpectedQueryPool()` helper ensures no DB query fires for invalid params. ✅
3. Read `backend/src/openapi/v1.yaml` diff — `ListId`/`ItemId` parameters updated with `format: uuid` and description "UUID"; `GET /lists/{listId}/items` and `POST /lists/{listId}/items` now include `404` response reference; `NotFound` description updated to "The requested list or item was not found." ✅
4. Read `backend/src/docs.test.js` diff — YAML content test gains `assert.match(response.text, /format: uuid/)`. ✅
5. Read `README.md` diff — One-liner updated to note path IDs must be UUIDs and invalid IDs return 404. ✅
6. Read `ROADMAP.md` diff — Added `Path-IDs: listId und itemId müssen UUIDs sein; ungültige Werte liefern 404.` under constraints. ✅
7. Ran `node --test src/v1.test.js src/docs.test.js` in `backend/` — **26/26 pass** (22 v1 + 4 docs; up from 22 pre-T-009). ✅
8. Ran `npm run lint` — 0 errors (1 pre-existing frontend fast-refresh warning). ✅
9. Ran `npm run build` — clean. ✅
10. Ran `npm test` (full backend suite) — **140/140 pass** (up from 136; 4 new v1 tests). ✅
11. Ran `npm run test --workspace frontend` — **409/409 pass**, 28/28 test files. ✅

##### Findings
- All acceptance criteria met: invalid `listId`/`itemId` (literal `{listId}`, `not-a-uuid`, etc.) → 404 with descriptive JSON; no PostgreSQL UUID parse error; all tests green.
- OpenAPI spec correctly documents UUID format constraint and the new 404 response on list-item endpoints.
- `createUnexpectedQueryPool()` helper proves no DB round-trip occurs for invalid IDs.
- No regressions.

##### Risks
- None. Guards short-circuit before any DB access; they cannot interfere with existing valid-UUID paths.

#### Open Questions
- None.

#### Verdict
`PASS`

## Task: T-010

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-17

#### Findings

No blocking or major issues found. Implementation is clean, consistent with prior v1 routes, and covers all plan scenarios.

- **nit** · `backend/src/routes/v1.js` — Name validation (`400`) is checked before `ensureListAccess` (`403`). This means a malformed request from an unauthorised user gets a 400, not a 403. This is an intentional and acceptable trade-off (fail-fast on bad input); consistent with how `POST /items` handles the same case.

- **nit** · `backend/src/openapi/v1.yaml` — `name` field in request body has `minLength: 1` but no `maxLength`. No issue — there is no DB column constraint to enforce here and the route already trims and rejects blank values at the application layer.

#### Verification

##### Steps
1. Read `backend/src/routes/v1.js` diff — New `router.patch("/lists/:listId/items/:itemId", ...)` handler inserted between the toggle and delete handlers. Logic order matches plan exactly: UUID guards → name validation → pool null-check → `ensureListAccess` → `UPDATE … RETURNING` → 404 if not found → 200 with `serializeItem`. Name is trimmed (`name.trim()`) before being passed to the query. ✅
2. Read `backend/src/v1.test.js` diff — PATCH endpoint added to both `endpointsRequiringApiKey` and `listAccessEndpoints` loops (403 test includes `{ name: "Oat milk" }` body). Seven new standalone tests cover all plan requirements: missing name → 400, blank name → 400, invalid listId → 404, invalid itemId → 404, unknown item → 404, successful rename → 200 (verifies SQL params and trim). ✅
3. Read `backend/src/openapi/v1.yaml` diff — `patch` operation added under `/lists/{listId}/items/{itemId}` path. `operationId: renameGroceryItem`, request body schema with `name` (required, `minLength: 1`), responses 200/400/401/403/404 all present. ✅
4. Read `backend/src/docs.test.js` diff — Added `assert.match(response.text, /operationId: renameGroceryItem/)` to YAML content test. ✅
5. Read `README.md` diff — `PATCH /api/v1/lists/:listId/items/:itemId` added to endpoint list. ✅
6. Read `ROADMAP.md` diff — Objective updated "Fünf" → "Sechs"; PATCH endpoint added between toggle and delete; acceptance criteria and docs scope updated to "6 Endpunkte". ✅
7. Ran `node --test src/v1.test.js src/docs.test.js` — **34/34 pass** (30 v1 + 4 docs; up from 26). ✅
8. Ran `npm run lint` — 0 errors (1 pre-existing frontend warning). ✅
9. Ran `npm run build` — clean. ✅
10. Ran `npm test` (full backend suite) — **148/148 pass** (up from 140; 8 new tests). ✅
11. Ran `npm run test --workspace frontend` — **409/409 pass**, 28/28 test files. ✅

##### Findings
- All acceptance criteria met: `PATCH` with valid name → 200 with updated item; 400 on missing/blank name; 403 on foreign list; 404 on unknown item or invalid UUID; OpenAPI spec documents new endpoint; all tests green.
- SQL uses `WHERE id = $2 AND list_id = $3` which correctly prevents cross-list item updates.
- `serializeItem()` reuse ensures response shape (`id`, `name`, `status`) is consistent with all other item endpoints.
- No regressions.

##### Risks
- None. The new route is fully isolated; it cannot affect existing routes.

#### Open Questions
- None.

#### Verdict
`PASS`

## Task: T-011

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-17

#### Findings

No blocking or major issues found. Implementation is correct, well-tested, and more defensive than the plan's minimal inline pattern.

- **nit** · `backend/src/routes/v1.js` `broadcastListEvent()` — The plan specified the inline `void sseManager.broadcastToList(...).catch(...)` pattern. The implementation extracts this into a helper and additionally wraps the call in a synchronous `try/catch`. This is strictly more defensive (handles synchronous throws from `broadcastToList`) and the helper reduces repetition across four call sites. The functional contract is identical.

- **nit** · `backend/src/v1.test.js` `waitForAsyncHandlers()` — `setTimeout(resolve, 0)` pushes to the macrotask queue, ensuring the `.catch()` microtask callback has already fired before log assertions are made. Correct and idiomatic for this test pattern.

#### Verification

##### Steps
1. Read `backend/src/routes/v1.js` diff — `logger` and `sseManager` imported with `default` aliases; both parameters added to `createV1Router` destructured signature with defaults. `broadcastListEvent()` helper added: uses `void Promise.resolve(...).catch(...)` pattern wrapped in `try/catch`; calls `logger.error` in both catch paths. Four `broadcastListEvent()` calls inserted immediately after the successful response data is available (before `res.status(...).json()` / `res.json()` / `res.status(204).send()`), with correct event types: `entry:created`, `entry:updated` (toggle), `entry:updated` (rename), `entry:deleted`. ✅
2. Verified `app.js` already includes `sseManager` in `routerOptions` (line 48) and passes it to `v1Routes(routerOptions)` (line 89) — no `app.js` changes needed. ✅
3. Read `backend/src/v1.test.js` diff — `createV1App` extended with `options.logger` and `options.sseManager ?? createSseManagerSpy()`. Three helpers added: `createSseManagerSpy()` (records calls, resolves), `createRejectingSseManager()` (records calls, rejects), `createLogCapture()` (pino in-memory sink). `waitForAsyncHandlers()` used to drain microtask/macrotask queues before log assertions. ✅
4. SSE spy assertions added to four existing mutation tests (create, toggle, rename, delete) — each verifies `[listId, eventType, { listId, entryId }]` tuple. ✅
5. One new test "keeps create responses successful when the SSE broadcast fails" — confirms 201 returned, `sseManager.calls` recorded, and error logged. ✅
6. All plan-required tests present: create → `entry:created`; toggle → `entry:updated`; rename → `entry:updated`; delete → `entry:deleted`; broadcast failure → no 500. ✅
7. Read `README.md` diff — SSE behaviour documented in the v1 API bullet. ✅
8. Read `ROADMAP.md` diff — SSE constraint and acceptance criterion added. ✅
9. Ran `node --test src/v1.test.js` — **31/31 pass** (up from 30). ✅
10. Ran `npm run lint` — 0 errors (1 pre-existing frontend warning). ✅
11. Ran `npm run build` — clean. ✅
12. Ran `npm test` (full backend suite) — **149/149 pass** (up from 148; 1 new test). ✅
13. Ran `npm run test --workspace frontend` — **409/409 pass**, 28/28 test files. ✅

##### Findings
- All acceptance criteria met: SSE events broadcast after every v1 mutation; web clients receive real-time updates without manual reload.
- Broadcast is non-blocking — `void` pattern ensures HTTP response is sent before (and regardless of) broadcast outcome.
- Broadcast errors are swallowed and logged, never surfaced as HTTP 500.
- `sseManager` flows correctly from `app.js` → `routerOptions` → `createV1Router` — no `app.js` changes required.
- No regressions to any previously green test.

##### Risks
- None. Broadcasts are fire-and-forget; failure is contained to the logger.

#### Open Questions
- None.

#### Verdict
`PASS`
