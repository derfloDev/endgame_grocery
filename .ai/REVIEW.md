# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

---

## Task: T-001 — DB Migration: `autocomplete_history` + `pg_trgm`

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-27

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `backend/src/db/migrations/1713902400000_add_autocomplete_history.cjs:40` | Plan specifies `DEFAULT NOW()` for `last_used_at`; migration uses `CURRENT_TIMESTAMP`. Functionally equivalent in PostgreSQL — no impact. | No |

No blockers, majors, or minors found.

#### Verification

##### Steps
1. Read migration file against plan schema spec.
2. Read updated `migrations.test.js` for coverage completeness.
3. Ran `npm run lint` (workspace root).
4. Ran `npm run build` (workspace root).
5. Ran `cd backend && npm test` to check migration test suite.
6. Confirmed pre-existing `license.test.js` failure is due to CRLF line endings in `LICENSE` file (not introduced by T-001; documented in task Evidence).

##### Findings
- Migration schema exactly matches the plan: all columns, types, constraints, index, and cascade rules are correct.
- `up()` creates extension, table, unique constraint, and index in the correct order.
- `down()` drops index, table (cascade), and extension in correct reverse order.
- Migration test verifies exact `pgm` call signatures for both `up` and `down` — all 3 migration tests pass.
- `npm run lint`: PASS (1 pre-existing warning in `AuthContext.jsx`, unrelated to T-001).
- `npm run build`: PASS.
- `npm test`: migration suite 3/3 pass; 1 pre-existing failure in `license.test.js` (CRLF vs LF in `LICENSE`) — not introduced by this task and already documented in task Evidence.

##### Risks
- None introduced by this change. The pre-existing `license.test.js` failure should be tracked separately.

#### Verdict
`PASS`

---

## Task: T-003 — Frontend: `useAutocomplete` Hook + `fetchSuggestions` API Client

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-27

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `frontend/src/hooks/useAutocomplete.js:85–88` | `loading` is set to `true` before the 300 ms debounce fires. The plan does not define loading behaviour during the debounce window, and this is a reasonable UX choice, but it means consumers will see `loading: true` before any network activity starts. | No |
| 2 | nit | `frontend/src/hooks/useAutocomplete.js:59–63` | `filterOfflineSuggestions` slices to 5 after filtering. Sensible and consistent with the backend `LIMIT 5`, but not explicitly required by the plan. | No |

No blockers, majors, or minors found.

#### Verification

##### Steps
1. Read `frontend/src/api/suggestions.js` — verified function signature, URL template, `createCacheKey` usage, `offlineFallbackMessage`.
2. Read `frontend/src/api/client.js` — confirmed `createCacheKey`, `sendJsonRequest`, and offline `{ ...cachedValue, offline: true }` return shape.
3. Read `frontend/src/hooks/useAutocomplete.js` in full — verified debounce (300 ms), short-input guard (< 2 chars), online/offline/error branches, Levenshtein implementation, request-sequence stale-guard, cleanup return.
4. Read `frontend/src/hooks/useAutocomplete.test.js` — verified all 4 required test cases are present and exercised.
5. Ran `npm run lint` (workspace root) — PASS.
6. Ran `npm run build` (workspace root) — PASS.
7. Ran `npm test` (backend, workspace root) — 37/37 PASS.
8. Ran `cd frontend && npm test` — 54/54 PASS (4 new `useAutocomplete` tests all green).

##### Findings
- `fetchSuggestions`: URL, `cacheKey: createCacheKey("suggestions", listId)`, `offlineFallbackMessage` — all match plan exactly.
- `useAutocomplete`: `inputText.trim().length < 2` guard resets state immediately; debounce via `window.setTimeout(…, 300)` with cleanup `window.clearTimeout`; online path sets `suggestions` from `result.suggestions`; offline path (`result?.offline`) applies `filterOfflineSuggestions` (substring + Levenshtein, sorted by `useCount DESC`); error path silently resets to `[]`.
- Levenshtein: two-row iterative, O(m·n) time / O(m) space — no external library; `maxDistance = Math.floor(query.length / 4) + 1` matches plan formula.
- Request-sequence ref guards against stale responses from rapid input (good defensive addition, not over-engineered).
- All 4 plan-required tests pass; debounce test verifies exactly 299 ms = no call, 300 ms = 1 call; offline test confirms "Milch" is excluded and "Schokolade" entries survive fuzzy match.

##### Risks
- None introduced. The `loading: true` during the debounce window (nit #1) is a cosmetic UX detail only.

#### Verdict
`PASS`

---

## Task: T-002 — Backend: Suggestions Endpoint + Entry Upsert

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-27

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `backend/src/routes/suggestions.js:5–21`, `backend/src/routes/entries.js:5–21` | `ensureListAccess` is duplicated verbatim in both routers. No shared utility module specified in the plan, so this is acceptable for now, but it is drift-prone if the access logic ever changes. | No |

No blockers, majors, or minors found.

#### Verification

##### Steps
1. Read `backend/src/routes/suggestions.js` against plan spec (auth, list access, q validation, SQL, response shape, export name).
2. Read `backend/src/routes/entries.js` upsert block against plan spec (placement, conflict target, increments, best-effort catch).
3. Read `backend/src/app.js` for correct mount order (suggestions before entries).
4. Read `backend/src/suggestions.test.js` — verified all 5 required test cases present.
5. Read `backend/src/entries.test.js` — verified 2 new upsert/best-effort tests added (callCount guard on history write, error-resilience test).
6. Read `backend/src/license.test.js` — confirmed CRLF normalisation fix (`.replace(/\r\n/g, "\n")`).
7. Ran `npm run lint` — PASS.
8. Ran `npm run build` — PASS.
9. Ran `cd backend && npm test` — 37/37 pass, 0 failures.

##### Findings
- `suggestions.js`: auth middleware, list access guard (403), q min-length guard (400), SQL uses `ILIKE` + `similarity() > 0.25`, `ORDER BY use_count DESC, last_used_at DESC`, `LIMIT 5`, response maps `use_count → useCount`. All match plan exactly.
- `entries.js`: upsert placed in nested try/catch after successful INSERT; `ON CONFLICT (user_id, list_id, text)` increments `use_count`, updates `icon` and `last_used_at`; history errors logged and swallowed — entry 201 response is unaffected. All match plan exactly.
- `app.js`: suggestions router registered at line 19, entries at line 20 — correct order per plan.
- All 5 suggestion route tests and 2 new entry tests exercise the plan acceptance criteria.
- `license.test.js` CRLF fix incidentally resolves the pre-existing test failure.
- `npm test` now passes with 0 failures (was 1 failure in prior cycle).

##### Risks
- `ensureListAccess` duplication (nit only): if access logic changes, both files must be updated consistently.
- No other risks identified.

#### Verdict
`PASS`
