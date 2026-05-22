# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-22

#### Findings

No blocking or major findings. All changes match the plan exactly.

- **severity: nit** — `backend/src/entries.test.js` line 82: the `assert.deepEqual(params, ["list-1", "Milk", "🥛", null])` comment in the test for "creates an entry with an icon" implicitly documents 4 bind params for status-as-literal. Not wrong, just worth awareness. No fix required.

#### Verification

##### Steps

1. Read all changed files: `backend/src/db/migrations/1778803200001_add_details_to_autocomplete_history.cjs`, `backend/src/db/historyUtils.js`, `backend/src/routes/entries.js`, `backend/src/routes/history.js`, `backend/src/routes/v1.js`, `backend/src/entries.test.js`, `backend/src/history.test.js`, `backend/src/db/migrations.test.js`, `backend/src/v1.test.js`.
2. Ran targeted tests: `node --test src/entries.test.js src/history.test.js src/db/migrations.test.js src/v1.test.js` (from `backend/`).
3. Ran `npm run lint` from the project root.
4. Ran `npm run build` from the project root.

##### Findings

- **Tests**: 73/73 pass, 0 failures.
- **Lint**: 0 errors; 1 pre-existing warning (`react-refresh/only-export-components` in `frontend/src/context/AuthContext.tsx`) — not introduced by this change.
- **Build**: succeeds; 1 pre-existing Vite chunk-size warning — not introduced by this change.

Code review findings:
- Migration (`1778803200001_add_details_to_autocomplete_history.cjs`): correctly adds a nullable `details text` column and provides a matching `down` function. ✓
- `historyUtils.js`: `details` defaults to `null`, is present in INSERT column list and in `DO UPDATE SET`. JSDoc updated. ✓
- `routes/entries.js` PATCH: when status becomes `"done"`, `result.rows[0].details` is forwarded to `upsertAutocompleteHistory`. ✓
- `routes/entries.js` DELETE: pre-delete SELECT now fetches `text, icon, details`; all three forwarded to `upsertAutocompleteHistory`. ✓
- `routes/history.js` GET: `ah.details` added to SELECT; `details` included in the response mapping. ✓
- `routes/v1.js` toggle-to-done: pre-toggle SELECT fetches `details`; forwarded to `upsertAutocompleteHistory`. ✓
- All acceptance criteria are covered by tests.

##### Risks

- None identified. The migration is additive (nullable column, no default), so existing rows are unaffected.

#### Open Questions

- None.

#### Verdict

`PASS`
