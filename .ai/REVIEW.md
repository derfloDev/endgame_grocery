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
