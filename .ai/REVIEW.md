# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-06-09

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `backend/src/routes/lists.js:238` | When the list does not exist in DB, the code still executes the DELETE query unnecessarily (the `!list` early-exit only fires after the DELETE). A simple `if (!list) { res.status(404)...; return; }` after the SELECT would skip the extra round-trip. Functionally correct as-is. | No |

No blockers or majors found.

#### Verification

##### Steps
1. Read `.ai/PLAN.md` T-001 scope and acceptance criteria.
2. Inspected `git diff HEAD` for all three changed files.
3. Ran `node --test backend/src/lists.test.js` — 11/11 pass (3 new tests added for success, owner-403, non-member-404).
4. Ran `npm run lint` — 0 errors (1 pre-existing unrelated warning in `AuthContext.tsx`).
5. Ran `npm run build` — success.
6. Ran `npm test` (full suite) — 174/174 pass.
7. Verified `/:id/leave` is registered before `/:id` (lines 209 vs 273) — correct Express ordering.
8. Confirmed mailer `await` pattern is identical to the existing `sharing.js` `sendRevocationEmail` pattern — consistent with codebase convention.
9. Verified `member-left.hbs` uses `{{> base ...}}` partial — consistent with other templates.
10. Confirmed `mailer` is properly injected as a dependency with a default `createMailer({ config })` fallback.

##### Findings
- All acceptance criteria met: 204/403/404 responses, SSE broadcast, owner email notification, tests.
- Route ordering is safe — `/:id/leave` is registered before `/:id`.
- Mailer failure behaviour (500 after successful DB delete) is consistent with the existing `sharing.js` pattern and is an accepted project convention.

##### Risks
- Low. The nit about the unnecessary DELETE query when the list is absent has negligible performance impact in normal operation.

#### Verdict
`PASS`

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-06-09

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `backend/src/routes/lists.js:69` | `GREATEST(COALESCE(MAX(e.updated_at), l.created_at), l.created_at)` — the outer `GREATEST(..., l.created_at)` is redundant when entries exist and `updated_at >= created_at`, but it acts as a defensive guard against data inconsistency. Plan's example used the simpler `COALESCE` form; the extra `GREATEST` is harmless and arguably safer. | No |

No blockers or majors found.

#### Verification

##### Steps
1. Read `.ai/PLAN.md` T-002 scope and acceptance criteria.
2. Inspected `git diff HEAD` for `backend/src/routes/lists.js` and `backend/src/lists.test.js`.
3. Verified `l.created_at` and `activity.last_activity` are added to the SELECT and result row mapping (lines 50–51, 87–88).
4. Verified the lateral join subquery is correct and handles the no-entries fallback via `COALESCE`.
5. Confirmed `created_at` / `last_activity` are returned as Date objects, serialised to ISO strings by `res.json()` — test assertions on ISO strings confirm this (lines 53–56 of test diff).
6. Ran `node --test backend/src/lists.test.js` — 11/11 pass.
7. Ran `npm run lint` — 0 errors.
8. Ran `npm run build` — success.
9. Ran `npm test` (full suite) — 174/174 pass.

##### Findings
- All acceptance criteria met: `created_at` and `last_activity` present as ISO strings; fallback to `created_at` when no entries verified by list-2 test case.
- SQL assertions in tests confirm the query contains `l.created_at`, `MAX(e.updated_at)`, and `last_activity`.

##### Risks
- None. The lateral join follows the same pattern as the existing `changes` lateral join in the same query.

#### Verdict
`PASS`
