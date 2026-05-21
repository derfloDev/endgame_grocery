# ROADMAP

Goal: ensure the optional description survives the done→recently-used→open round-trip, and that items toggled via the external v1 API appear in "Zuletzt Verwendet".

## Priority 1 — Frontend: preserve details through the recently-used pipeline

Objective: fix the data-loss bug so that an entry's `details` field is kept when it moves from open → recently used → open.

- `Suggestion` type gains an optional `details` field.
- `upsertRecentlyUsedItems` stores the entry's `details` alongside `text` and `icon`.
- `RecentlyUsedSection.onAdd` callback forwards `details` to the caller.
- `addRecentlyUsedEntry` passes `details` through to `addEntryByText`.
- All affected tests are updated or extended to cover the new behaviour.

## Priority 2 — Backend: v1 toggle endpoint upserts autocomplete history

Objective: when an item is toggled to "done" via `POST /api/v1/lists/{listId}/items/{itemId}/toggle`, write it to `autocomplete_history` so it appears in "Zuletzt Verwendet".

- Extract `upsertAutocompleteHistory` from `entries.js` to a shared utility module.
- v1 toggle handler fetches `icon` in the SELECT and calls the shared utility when `nextStatus === "done"`.
- v1 tests are extended: assert the history upsert is called on done-toggle and skipped on open-toggle.

## Priority 3 — Real-time sync: "Zuletzt Verwendet" updates without page reload

Objective: after an external toggle (e.g. Home Assistant), the "Zuletzt Verwendet" section refreshes automatically in the open browser tab.

- Fix race condition in `v1.js`: await the history upsert before broadcasting the SSE event.
- Fix frontend: on `entry:updated` SSE, re-fetch the history API so "Zuletzt Verwendet" reflects the server state.
