# Plan

Status: **ready**

Goal: Fix the "done" badge disappearing immediately in the recently-used section after the current user toggles an entry from open to done.

## Scope

A single React hook change in `useListDetailData.ts` plus one new integration test in `ListDetailPage.test.tsx`.

No changes to `recentlyUsedState.ts` or its tests — the display-state logic is correct and does not need to change.

## Root Cause

When User A toggles an entry to done:
1. `toggleStatus` sets `is_changed: true` optimistically in React state.
2. The SSE event `entry:updated` fires on User A's client, triggering `handleEntryChange` → `loadEntries()`.
3. `loadEntries()` replaces local entries with fresh server data. The server returns `is_changed: false` for User A — `is_changed` is a server-side flag for *other* users who haven't seen the change yet. User A is the author, so the server never sets it for them.
4. `getRecentlyUsedDisplayState` sees `is_changed: false` → `changedDoneTexts` is empty → the "done" badge disappears.

## Acceptance Criteria

- After User A toggles an entry to "done", its chip in the recently-used section shows the "done" badge.
- The badge persists after SSE-triggered `loadEntries()` calls during the same page session.
- The badge is gone after User A navigates away and back (full list reload resets local tracking).
- The badge is gone after a browser page reload.
- Only locally-performed toggles produce a badge; entries toggled by other users do not get a stale badge on User A's view.

## Implementation

### Phase 1 — Add `locallyDoneIdsRef` to `useListDetailData`

**File:** `frontend/src/pages/ListDetailPage/useListDetailData.ts`

1. **Add ref declaration** directly after the existing `useRef` for `isMountedRef`:
   ```ts
   const locallyDoneIdsRef = useRef<Set<string>>(new Set());
   ```

2. **Clear the ref at list load start** inside `loadListDetail` (the `useEffect`), right after `setRecentlyUsed([])`:
   ```ts
   locallyDoneIdsRef.current = new Set();
   ```
   This ensures the set is empty whenever the user navigates to a list (listId/token/syncVersion change).

3. **Populate the ref in `toggleStatus`** when completing an entry — add before the optimistic `updateEntries` call:
   ```ts
   if (isCompletingEntry) {
     locallyDoneIdsRef.current.add(entry.id);
   }
   ```
   And clean up in the error branch (revert path), after the reverted `updateEntries`:
   ```ts
   if (isCompletingEntry) {
     locallyDoneIdsRef.current.delete(entry.id);
     // existing: setRecentlyUsed filter...
   }
   ```

4. **Apply the ref in `loadEntries`** when mapping server entries to local state. Replace the bare cast:
   ```ts
   const nextEntries = (entriesResult.entries ?? []) as DetailEntry[];
   ```
   with:
   ```ts
   const nextEntries = (entriesResult.entries ?? []).map((e) =>
     locallyDoneIdsRef.current.has((e as DetailEntry).id)
       ? { ...(e as DetailEntry), is_changed: true }
       : (e as DetailEntry)
   );
   ```

### Phase 2 — Add integration test

**File:** `frontend/src/pages/ListDetailPage.test.tsx`

Add one new test case inside the `"ListDetailPage optimistic updates"` describe block, after the existing `"shows a Done badge immediately when the current user completes an item"` test:

**Test: `"preserves the Done badge after an SSE-triggered entry reload"`**

Scenario:
1. Initial load: one open entry "Milk" (`entry-1`), no history.
2. `updateEntry` resolves immediately with a server entry that has `is_changed: false` (as the server would return for User A).
3. User clicks "Mark Milk done".
4. Wait for the "Done" badge to appear in the recently-used section (optimistic, before reload).
5. Simulate an `entry:updated` SSE event by calling the registered handler.
6. `fetchEntries` second call returns the entry with `status: "done"` but `is_changed: false`.
7. `fetchRecentlyUsed` second call returns `[{ text: "Milk", icon: "IconMilk" }]`.
8. Wait for the reload to complete.
9. Assert the "Done" badge is still visible in the recently-used section.

## Files to Change

| File | Change |
|------|--------|
| `frontend/src/pages/ListDetailPage/useListDetailData.ts` | Add `locallyDoneIdsRef`, populate in `toggleStatus`, apply in `loadEntries`, clear in `loadListDetail` |
| `frontend/src/pages/ListDetailPage.test.tsx` | Add test: "preserves the Done badge after an SSE-triggered entry reload" |

## Validation

```
npm run lint
npm run build
npm test
```
