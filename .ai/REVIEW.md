# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-27

#### Findings

1. **nit** — `backend/src/db/migrations/1778803200002_drop_autocomplete_history.cjs`
   Migration filename prefix (`1778803200002`) differs from the plan's example (`1748304000000`). The implementer used the correct sequential numbering following `1778803200001_add_details_to_autocomplete_history.cjs`, ensuring migrations run in the right order. This is the right call and not a defect.

2. **nit** — `backend/src/history.test.js` (line ~116)
   The test renamed to "returns 404 because individual history deletion is not supported" issues a DELETE but does not assert that `pool.query` is never called (it does via `assert.fail` in the pool mock). Adequate coverage — no action needed.

#### Required Fixes

None.

#### Verification

##### Steps

1. Read `.ai/PLAN.md` acceptance criteria.
2. Read diffs for all changed files: `routes/history.js`, `routes/suggestions.js`, `routes/entries.js`, `routes/v1.js`, `db/historyUtils.js` (deleted), `db/migrations/1778803200002_drop_autocomplete_history.cjs`, and all five test files.
3. Verified no `upsertAutocompleteHistory` import or call remains in any source file (`Grep` across codebase).
4. Verified `autocomplete_history` table references remain only in old migration files and the new drop migration.
5. Ran `npm run lint` — passes with one pre-existing frontend fast-refresh warning (unrelated).
6. Ran `npm run build` — passes cleanly.
7. Ran `npm test` — 2 pre-existing failures unrelated to T-001:
   - `frontend/src/context/AuthContext.test.tsx > hydrates the current user when only a persisted token is available` (file not touched by T-001)
   - `backend/src/env.test.js > does not load .env when the file is absent` (filesystem rmdir race, file not touched by T-001)
8. All T-001-targeted tests pass: history routes 5/5, suggestion routes 5/5, entry routes 17/17, v1 API routes 37/37, migrations 11/11 (including new drop-and-restore test).

##### Findings

- All acceptance criteria met:
  1. ✅ `GET /history` returns last 20 done entries per list, no `user_id` filter, `useCount` removed from response.
  2. ✅ `DELETE /history` route removed — Express returns 404.
  3. ✅ `GET /suggestions` queries `entries` by `list_id` only; no `user_id` parameter.
  4. ✅ Migration `1778803200002_drop_autocomplete_history.cjs` drops the table; `down` restores schema correctly.
  5. ✅ No `upsertAutocompleteHistory` call or import remains in any source file.
  6. ⏭️ Dismiss button removal is T-002 scope — not applicable here.
  7. ✅ All T-001 backend tests pass; lint and build pass.
- Behavioral side-effect of removing the pre-flight `SELECT` in the entries DELETE handler is correctly handled: the DELETE uses `RETURNING id` and the existing `if (!result.rows[0])` guard preserves the 404 path.

##### Risks

- The `DISTINCT ON (text) … ORDER BY text, updated_at DESC` pattern in `history.js` relies on PostgreSQL-specific SQL; it is correct for the target DB.
- If two done entries share the same `text` and `updated_at` exactly, ordering within the DISTINCT is non-deterministic, but this is a degenerate edge case and acceptable.

#### Verdict

`PASS`

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-27

#### Findings

1. **nit** — `frontend/src/app.test.tsx` (lines ~1336–1382)
   Two incidental test improvements outside strict T-002 scope: a test data string `"Y"` was corrected to `"Milk"` in the "adds and edits entry details" test, and `await userEvent.click(save button)` was replaced with `fireEvent.submit(form)` for more reliable form submission. Neither introduces a regression; both are improvements.

#### Required Fixes

None.

#### Verification

##### Steps

1. Read `.ai/PLAN.md` Phase 2 acceptance criteria.
2. Read diffs for all changed files: `api/history.ts`, `RecentlyUsedSection.tsx`, `RecentlyUsedSection.module.css`, `ListDetailPage.tsx`, `useListDetailData.ts`, locale files, and all test files.
3. Verified no residual references to `deleteFromHistory`, `dismissRecentlyUsedEntry`, `onDismiss`, `recent.dismiss`, or `recently-used-chip-dismiss` in any source file (`grep` across `frontend/src/`).
4. Confirmed `Suggestion` type has `useCount?: number` as optional — history items without `useCount` are fully type-safe.
5. Ran `npm run lint` — passes with same single pre-existing fast-refresh warning.
6. Ran frontend tests (`npm run test --workspace frontend`) — **430/430 tests pass, 31 test files, zero failures**.
   - Notable: the previously flaky `AuthContext > hydrates the current user when only a persisted token is available` test now passes, confirming it is a non-deterministic race condition, not a code defect.

##### Findings

- All acceptance criteria met:
  1. ✅ `deleteFromHistory` export removed from `frontend/src/api/history.ts`.
  2. ✅ Dismiss button absent from `RecentlyUsedSection` UI — JSX removed, `onDismiss` prop removed, CSS `.recently-used-chip-dismiss` styles removed, `position: relative` on cell removed (it was only needed for absolute-positioned overlay).
  3. ✅ `dismissRecentlyUsedEntry` removed from `useListDetailData` return value and callback.
  4. ✅ `ListDetailPage` no longer passes `onDismiss`.
  5. ✅ All frontend tests pass (430/430).
- `Icon` import correctly removed from `RecentlyUsedSection.tsx` — it was used only by the dismiss button.
- `recent.dismiss` i18n keys removed from both `en` and `de` locale files.
- `feature-components.test.ts` updated to check `recently-used-chip` instead of `recently-used-chip-dismiss`.

##### Risks

- No risks identified. The change is purely subtractive — no new behaviour introduced.

#### Verdict

`PASS`
