# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-27

#### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `backend/src/routes/history.js:5-21` | `ensureListAccess` is copy-pasted from `entries.js`; a shared helper module would eliminate the duplication. | No — plan does not require refactoring; both copies are identical and correct. |
| 2 | nit | `backend/src/routes/entries.js:161` | History upsert fires whenever the PATCH result has `status === 'done'`, not only on a `open → done` transition. Editing the text of an already-done entry would re-fire the upsert. The upsert is idempotent so no data corruption occurs; it does match the exact plan wording ("if `status === 'done'`"). | No — matches plan wording; AC covered correctly by tests. |

#### Required Fixes

None.

#### Verification

##### Steps Performed

1. Read `.ai/PLAN.md` and `.ai/TASKS.md` to confirm T-001 scope.
2. Read all changed files: `backend/src/routes/entries.js`, `backend/src/routes/history.js`, `backend/src/app.js`, `backend/src/entries.test.js`, `backend/src/history.test.js`, `README.md`.
3. Checked `git diff HEAD` for entries.js to confirm POST history block removed, PATCH upsert added, DELETE pre-fetch + upsert added.
4. Verified `app.js` registers `/api/lists/:id/history` using `historyRoutes(options)`.
5. Ran `npm run lint` — 0 errors; 1 pre-existing warning in `frontend/src/context/AuthContext.jsx` (unrelated to T-001).
6. Ran `npm run build` — succeeded (frontend Vite build + backend syntax check).
7. Ran `npm test` — 45/45 backend tests pass (7 entry route + 7 history route + remaining suites); 62/62 frontend tests pass.
8. Verified README update is accurate and scoped to the behaviour change.

##### Findings

- All five acceptance criteria satisfied:
  1. POST /entries — no `autocomplete_history` write (removed block confirmed in diff). ✅
  2. PATCH → done — upserts history (implemented, test passes). ✅
  3. DELETE entry — fetches text+icon pre-delete then upserts history (implemented, test passes). ✅
  4. GET /history — ≤20 items, `NOT EXISTS` open-entry filter, `ORDER BY use_count DESC, last_used_at DESC`. ✅
  5. DELETE /history — 204; 400 on blank text; 403 on inaccessible list; idempotent. ✅
- Lint: clean (no new warnings introduced).
- Build: clean.
- Tests: all pass.

##### Risks

- Low: `ensureListAccess` duplication — risk of drift in access-check logic if one copy is updated without the other. No immediate impact; should be refactored in a future cleanup task.
- Low: PATCH history fires on text edits of already-done entries; increments `use_count` unnecessarily. No user-facing regression; idempotent at data level.

#### Verdict

`PASS`

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-28

#### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `frontend/src/pages/ListDetailPage.jsx:313` | `visibleRecentlyUsed` passes `openEntries` (already filtered to `status === "open"`) into `filterRecentlyUsed`, which runs `.filter((entry) => entry.status === "open")` again. The second filter is a no-op; harmless but slightly redundant. | No |
| 2 | nit | `frontend/src/components/RecentlyUsedSection.jsx:11` | `resolveIconName` returns `FALLBACK_ICON_NAME` when an icon string is unknown, then line 29 further guards with `?? FALLBACK_ICON`. Double-fallback is belt-and-suspenders but adds a small amount of complexity; both imports are used. | No |

#### Required Fixes

None.

#### Verification

##### Steps Performed

1. Re-read `.ai/PLAN.md` and `.ai/TASKS.md` to confirm T-002 scope and acceptance criteria.
2. Read all new/changed files: `frontend/src/api/history.js`, `frontend/src/components/RecentlyUsedSection.jsx`, `frontend/src/components/RecentlyUsedSection.test.jsx`, `frontend/src/pages/ListDetailPage.jsx`, `frontend/src/index.css` (diff), `frontend/src/app.test.jsx` (diff).
3. Verified `git diff HEAD -- frontend/src/pages/ListDetailPage.jsx` removes all of: `doneOpen` state, `doneEntries` derivation, and the Done `<section>` JSX block. No Done-related lines added.
4. Confirmed `filterRecentlyUsed` is applied both at load time (`setRecentlyUsed(filterRecentlyUsed(...))`) and at render time (`visibleRecentlyUsed = filterRecentlyUsed(recentlyUsed, openEntries)`).
5. Confirmed `fetchRecentlyUsed` error is caught inline (`return { history: [] }`) so a history API failure does not break the page load.
6. Confirmed `handleAddFromHistory` has rollback logic: if `addEntryByText` returns false, the chip is re-inserted into the panel.
7. Ran `npm run lint` — 0 errors; 1 pre-existing warning in unrelated file.
8. Ran `npm run build` — succeeded.
9. Ran `npm test` — 63/63 frontend tests pass (new `RecentlyUsedSection.test.jsx` + updated `app.test.jsx`); 45/45 backend tests pass.

##### Findings

| AC | Description | Status |
|----|-------------|--------|
| 6 | Recently Used section below Open Items when history non-empty; hidden when empty (`items.length === 0` guard in component). | ✅ |
| 7 | Chip tap: optimistic remove → `addEntryByText` → rollback on failure. E2E test confirms chip disappears after tap. | ✅ |
| 8 | Dismiss button: optimistic remove → `deleteFromHistory` fire-and-forget. E2E test confirms DELETE is called with correct body. | ✅ |
| 9 | Done section fully removed: `doneOpen`, `doneEntries`, all Done JSX deleted. E2E asserts `queryByText("DONE")` is null. | ✅ |
| 10 | Open items excluded: server-side `NOT EXISTS` filter (T-001) + client-side `filterRecentlyUsed` at load and on render. | ✅ |

##### Risks

- Low: double `filterRecentlyUsed` call (load + render) is harmless but slightly redundant.
- Low: history fetch errors are silently swallowed — intentional per plan ("best-effort"), but means transient failures are invisible to the user.

#### Verdict

`PASS`
