# ROADMAP

Goal: Prevent unbounded database growth by capping the number of list entries per list and per status.

## Priority 1

Objective: Enforce per-list entry limits for "open" and "done" statuses.

- **Open-entry cap (1 000):** When a `POST /api/lists/:id/entries` request would create the 1 001st "open" entry in a list, reject the request with HTTP 422 and a user-readable error message. The frontend surfaces this message to the user.
- **Done-entry cap (200, auto-evict):** When a `PATCH /api/lists/:id/entries/:entryId` request transitions an entry to `"done"` and the list already has 200 "done" entries, automatically delete the oldest "done" entry (by `updated_at` or `created_at`) before completing the update. No error is shown to the user.
- The limits are enforced inside the existing route handlers in `backend/src/routes/entries.js` using a COUNT query before the mutating SQL.
- Frontend receives the 422 error and displays an appropriate inline message to the user.

### Acceptance criteria
- Creating the 1 001st open entry returns HTTP 422 with `{ error: "..." }` and no entry is inserted.
- Creating the 1 000th open entry succeeds normally.
- Transitioning to "done" when 200 done entries exist deletes the oldest done entry and completes the status change atomically; the caller receives the updated entry.
- Transitioning to "done" when fewer than 200 done entries exist is unaffected.
- All existing entry-creation and entry-update tests continue to pass.
- New unit/integration tests cover the boundary conditions for both limits.
