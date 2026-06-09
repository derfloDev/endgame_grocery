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

---

## Task: T-003

### Review Round 1

Status: **PASS**

Reviewed: 2026-06-09

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `frontend/src/api/sharing.ts` `leaveList` | `queueable: true` means the DELETE is enqueued when offline — consistent with the app's offline-first patterns, but plan doesn't specify offline behaviour. No fix required. | No |

No blockers or majors found.

#### Verification

##### Steps
1. Read `.ai/PLAN.md` T-003 scope and acceptance criteria.
2. Inspected `git diff HEAD` for all 14 changed/new files.
3. Verified `leaveList` API calls `DELETE /api/lists/:id/leave` with auth header — confirmed by `sharing.test.ts`.
4. Verified `ListCardHome` — `onLeave` prop added; menu button condition `list.is_owner || onLeave`; non-owner menu shows only "Leave list"; owner menu shows Rename/Delete unchanged.
5. Verified `ListOptionsSheet` — early-return changed from `!open || !isOwner` to `!open`; `onLeaveSelect` prop added; non-owner sees Leave row (icon + label + desc); owner sees Rename/Share unchanged.
6. Verified `OverviewPage` — `handleLeave` wired through `leaveSharedList` utility; `onLeave` passed as `undefined` for owner cards; optimistic removal via `updateLists` filter; cache written via `writeCachedResource`.
7. Verified `ListDetailPage` — TopBar actions condition changed from `list?.is_owner` to `list` (correct — non-owners need the ⋮ button); `onLeaveSelect` passed to `ListOptionsSheet`; `navigate("/")` on success.
8. Verified `leaveListAction.ts` shared utility encapsulates `window.confirm` guard + API call + callbacks — clean deduplication used by both OverviewPage and ListDetailPage.
9. Verified `getInitials`/`getChangeKind`/`getErrorMessage` extracted to `listDetailUtils.ts` — pure refactor, logic unchanged.
10. Verified i18n: `list.leaveList`, `list.leaveListDesc`, `list.leaveConfirm` present in EN + DE with correct values matching the plan.
11. Ran `npm test --workspace=frontend` — 463/463 pass (36 test files).
12. Ran `npm test` (full suite) — 174/174 backend pass.
13. Ran `npm run lint` — 0 errors.
14. Ran `npm run build` — success.

##### Findings
- All six acceptance criteria satisfied: non-owner card menu, non-owner options sheet, confirm guard, optimistic overview removal, detail-page navigation to "/", correct API endpoint.
- Integration tests cover both paths (overview list removal, detail-page navigation).

##### Risks
- None. The shared `leaveSharedList` utility avoids duplication and is straightforward.

#### Verdict
`PASS`

---

## Task: T-004

### Review Round 1

Status: **PASS**

Reviewed: 2026-06-09

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `OverviewPage.tsx:205` | `event.target.value as OverviewSortMode` — type cast without runtime guard. The controlled `<select>` with fixed `<option>` values makes an invalid value impossible in practice. Not a real risk. | No |

No blockers or majors found.

#### Verification

##### Steps
1. Read `.ai/PLAN.md` T-004 scope and acceptance criteria.
2. Inspected `git diff HEAD` for all changed files.
3. Verified `overviewSort.ts` — pure `sortLists<T extends List>(lists, mode)` function with `comparePresentValues` helper treating `undefined` as sorted-last. All three modes (`created_asc`, `name_asc`, `activity_desc`) implemented correctly.
4. Verified `isOverviewSortMode` type guard used for localStorage validation — invalid/absent values fall back to `DEFAULT_OVERVIEW_SORT = "created_asc"`.
5. Verified `useState` lazy initializer reads localStorage on mount; `handleSortChange` writes on every change — correct persistence pattern.
6. Verified `<select>` is inside `overview-actions` which is inside `overview-brand` — satisfies plan placement requirement.
7. Verified `<label className="visually-hidden" htmlFor="overview-sort">` — `visually-hidden` class confirmed in `frontend/src/styles/shared.css`.
8. Verified `sortedLists` is applied before the list map render (line 232).
9. Verified `List` type gains `created_at?: string` and `last_activity?: string` — optional fields safe for offline cached data.
10. Verified i18n: `overview.sortLabel`, `overview.sortCreatedAsc`, `overview.sortNameAsc`, `overview.sortActivityDesc` present in EN + DE with correct values.
11. Verified `overviewSort.test.ts` — 3 unit tests covering all three sort modes including missing-field (undefined) case.
12. Verified `OverviewPage.test.tsx` — 3 integration tests: immediate reorder + localStorage write, restore valid preference, fallback for invalid preference.
13. Ran `npm test --workspace=frontend` — 469/469 pass (37 test files).
14. Ran `npm run lint` — 0 errors.
15. Ran `npm run build` — success.

##### Findings
- All six acceptance criteria satisfied: sort control with 3 options, immediate reorder, localStorage persistence under `"overview_sort"`, page-reload restore, offline safety (undefined → sorted last, no crash), i18n EN + DE.
- Responsive CSS added: `overview-brand` stacks vertically and sort control wraps at ≤ 480px.

##### Risks
- None.

#### Verdict
`PASS`
