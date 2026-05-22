# PLAN — recently-used-details

Status: **ready_for_implement**

## Goal

Persist the `details` field in `autocomplete_history` so that entry details
survive the full round-trip: open → recently-used → open, including across
page reloads.

## Root-cause summary

`autocomplete_history` has no `details` column. `upsertAutocompleteHistory`
ignores `details`. The GET `/history` endpoint returns only `text`, `icon`,
and `use_count`. Any details present on an entry are therefore lost the moment
the server is queried for history (on page reload at the latest).

The frontend already threads `details` correctly through
`upsertRecentlyUsedItems` and `addRecentlyUsedEntry`; no frontend changes are
required.

---

## Task T-001 — Persist `details` in autocomplete history (backend)

### Files to change

| File | Change |
|------|--------|
| `backend/src/db/migrations/<next_ts>_add_details_to_autocomplete_history.cjs` | New migration: add nullable `details text` column to `autocomplete_history` |
| `backend/src/db/historyUtils.js` | Accept `details` param; include it in the `INSERT … ON CONFLICT DO UPDATE` statement |
| `backend/src/routes/entries.js` | PATCH handler: pass `result.rows[0].details` to `upsertAutocompleteHistory`; DELETE handler: include `details` in the pre-delete SELECT and pass it to `upsertAutocompleteHistory` |
| `backend/src/routes/history.js` | Add `ah.details` to the SELECT columns; include `details` in the response mapping |
| `backend/src/entries.test.js` | Update and extend tests to assert `details` is forwarded to `upsertAutocompleteHistory` on done and on delete |
| `backend/src/history.test.js` | Update and extend tests to assert `details` is included in the GET response |

### Step-by-step implementation order

1. **Migration** – create a new `.cjs` file with a timestamp one increment
   above `1778803200000` (current latest). Add a nullable `details text` column
   (no `NOT NULL`, no default) so existing rows are unaffected. Include a
   matching `down` function that drops the column.

2. **`historyUtils.js`** – extend `upsertAutocompleteHistory`:
   - Add `details` to the destructured parameter.
   - Add `details` to the INSERT column/value list and to the `DO UPDATE SET`
     clause.
   - Update the JSDoc `@param` block.

3. **`routes/entries.js`** – two call sites:
   - **PATCH** (status → done): add `details: result.rows[0].details` to the
     `upsertAutocompleteHistory` call.
   - **DELETE**: the pre-delete SELECT currently fetches `text` and `icon`;
     add `details` to that SELECT, then forward it to `upsertAutocompleteHistory`.

4. **`routes/history.js`** – GET handler:
   - Add `ah.details` to the `SELECT` list.
   - In `result.rows.map(...)`, include `details` in the returned object
     (always include it, even as `null`, so the frontend's existing
     `entry.details ?? existing?.details` fall-through in
     `upsertRecentlyUsedItems` works correctly).

5. **Tests** – write/update before or alongside each change:
   - `entries.test.js`: assert `details` is included in the
     `upsertAutocompleteHistory` call when an entry is marked done or deleted;
     add a case for `null` details.
   - `history.test.js`: assert the GET response includes `details` when the DB
     row has a non-null value; add a case for `null` details.

### Acceptance criteria

1. Marking an entry with details as done → reload the page → the recently-used
   chip still shows the entry; adding it back restores the same details.
2. Marking the entry done a second time → details still present in recently used.
3. Entries without details: no regression; `details` is `null` in the response
   and the chip continues to work.
4. `npm test` passes in both `backend/` and `frontend/`.
5. `npm run build` succeeds.
6. `npm run lint` passes.

### Out of scope

- Frontend changes (already correct).
- Any changes to the `suggestions` route.
- E2E / Playwright tests — unit and integration tests are sufficient.

## Validation

- `npm run lint`
- `npm run build`
- `npm test`
