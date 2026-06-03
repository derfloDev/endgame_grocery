# ROADMAP

Goal: Fix the "done" badge disappearing immediately in the recently-used section after the current user toggles an entry from open to done.

## Priority 1

Objective: Persist the "done" badge on recently-used items for the user who performed the toggle, until they navigate away from the list or reload the page.

**Bug description:**
When User A toggles an entry from "open" to "done":
1. `toggleStatus` optimistically sets `is_changed: true` on the entry in local state.
2. An SSE event (`entry:updated`) fires on User A's client, triggering `handleEntryChange` → `loadEntries()`.
3. `loadEntries()` replaces local entries with fresh server data. The server returns `is_changed: false` for User A — because `is_changed` is a server-side flag that only marks changes as "unseen" for *other* users (User A is the author of the change, so the server does not flag it for them).
4. `getRecentlyUsedDisplayState` sees `is_changed: false` → `changedDoneTexts` is empty → the "done" badge disappears immediately for User A.

User B (a different client) correctly sees the badge because the server returns `is_changed: true` for them.

**Acceptance criteria:**
- After User A toggles an entry to "done", its chip in the recently-used section shows the "done" badge.
- The badge remains visible for User A even after server reloads triggered by SSE events during the same page session.
- The badge is gone after User A navigates away from the list detail page and back (full list reload clears local state).
- The badge is gone after a browser page reload.
- No regression: entries toggled to "done" by User B are not incorrectly badged on User A's view (only locally-performed toggles are tracked).

**Constraints:**
- Track locally-changed entries by entry ID to avoid false positives.
- The local tracking set must be cleared when `loadListDetail` (the initial `useEffect`) re-runs — i.e., on listId/token/syncVersion change, which is equivalent to navigating away and back.
- The fix lives in `useListDetailData.ts`; `getRecentlyUsedDisplayState` in `recentlyUsedState.ts` does not need to change.
- Solution: add a `locallyDoneIdsRef` (`useRef<Set<string>>`) inside `useListDetailData`. When `toggleStatus` marks an entry as done, add its ID to the ref. When `loadEntries` merges server data, force `is_changed: true` for any entry whose ID is in `locallyDoneIdsRef`. Clear the ref at the start of `loadListDetail`.

**Files to change:**
- `frontend/src/pages/ListDetailPage/useListDetailData.ts` — add `locallyDoneIdsRef`, populate in `toggleStatus`, apply in `loadEntries`, clear in `loadListDetail`
- `frontend/src/pages/ListDetailPage.test.tsx` — add/update tests covering badge-persistence after SSE-triggered reload
- `frontend/src/pages/recentlyUsedState.test.ts` — verify no regression in display-state logic (likely no changes needed here)
