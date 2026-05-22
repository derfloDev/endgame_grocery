# ROADMAP

Goal: preserve entry details through the open ↔ recently-used transition.

## Priority 1

Objective: store and restore the `details` field in the autocomplete history so that
details survive the round-trip from "offene Einträge" → "zuletzt verwendet" → "offene Einträge",
including across page reloads.

### Root cause

The `autocomplete_history` table has no `details` column. When an entry is
marked done the backend calls `upsertAutocompleteHistory` without `details`;
the GET `/history` endpoint returns only `text`, `icon`, and `use_count`.
On a fresh page load the client therefore loses the details for every
recently-used item.

### Scope

Backend:
- DB migration: add nullable `details text` column to `autocomplete_history`
- `historyUtils.js` – `upsertAutocompleteHistory`: accept and persist `details`
- `routes/entries.js` – PATCH (status → done): pass `entry.details` to `upsertAutocompleteHistory`
- `routes/entries.js` – DELETE: pass `entry.details` to `upsertAutocompleteHistory` (requires fetching `details` from the DB before deletion)
- `routes/history.js` – GET: include `details` in the response payload

Frontend:
- No changes needed; the frontend already handles `details` in the `Suggestion`
  type and correctly passes it through `upsertRecentlyUsedItems` and
  `addRecentlyUsedEntry`.

### Acceptance criteria

1. After marking an entry with details as done, the recently-used chip still
   carries the same details value (even after a page reload).
2. Clicking a recently-used chip that has details re-creates the entry in
   "offene Einträge" with those details intact.
3. Moving an entry back to "zuletzt verwendet" again (mark done a second time)
   continues to preserve the details.
4. Entries without details continue to work as before (no regression).
5. All existing backend and frontend tests continue to pass; new tests cover the
   new `details` persistence behaviour.
