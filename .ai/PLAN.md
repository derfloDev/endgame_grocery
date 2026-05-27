# PLAN — fix/pwa-sync

Status: **ready**

## Overview

Two bugs in the PWA offline/sync layer cause permanently stuck pending-change banners:

- **T-001**: Queue never drains after PWA returns from idle (Bug 1)
- **T-002**: Non-retriable 4xx errors block the queue forever (Bug 2)

Both tasks touch `OfflineQueueContext.tsx` as the primary file. T-001 must be implemented first; T-002 builds on the same file and adds a discard UI flow.

---

## T-001 — Auto-drain queue after PWA idle

### Problem
`handleQueueChanged` in `OfflineQueueContext.tsx` only calls `refreshQueuedCount()`.  
When a mutation is added to the queue while the device is already marked as "online" (e.g. because the first request after idle fails with a `TypeError`), `drainQueue()` is never triggered again — the `online` event does not re-fire and there is no `visibilitychange` listener.

### Implementation Steps

1. **`isSyncingRef` guard** to avoid stale-closure issues:
   - Add `const isSyncingRef = useRef(false)` that mirrors `isSyncing` state.
   - Set `isSyncingRef.current = true` at the top of `drainQueue()` before `setIsSyncing(true)`.
   - Set `isSyncingRef.current = false` in the `finally` block before `setIsSyncing(false)`.
   - Guard at the top of `drainQueue()`: `if (isSyncingRef.current) return;`.

2. **`visibilitychange` listener** (inside the existing `useEffect`):
   - Add `document.addEventListener("visibilitychange", handleVisibilityChange)`.
   - `handleVisibilityChange`: if `document.visibilityState === "visible"` and `navigator.onLine`, call `drainQueue()`.
   - Remove listener in the cleanup return.

3. **`handleQueueChanged` extended**:
   - After `void refreshQueuedCount()`, if `navigator.onLine` is true, also call `void drainQueue()`.

### Files
| File | Change |
|------|--------|
| `frontend/src/context/OfflineQueueContext.tsx` | Add `isSyncingRef`, `visibilitychange` listener, call `drainQueue()` in `handleQueueChanged` when online |
| `frontend/src/context/OfflineQueueContext.test.tsx` | New file: tests for visibilitychange trigger and queue-changed drain |

### Acceptance Criteria
- Becoming visible (`document.visibilityState` → `"visible"`) while online triggers a drain.
- Adding a mutation while online immediately triggers a drain.
- Concurrent drain runs are prevented by `isSyncingRef`.
- All existing online/offline/queue-changed behavior is preserved.

---

## T-002 — Discard non-retriable failed mutations

### Problem
In `drainQueue()`, a 4xx HTTP error (e.g. `404 Entry not found`) throws the same error path as transient network errors. The failing mutation is never removed from the queue, so every subsequent drain attempt repeats the same failure indefinitely.

### Implementation Steps

1. **Classify errors in `drainQueue()`**:
   - After `const response = await fetch(...)`, check `response.ok`.
   - If `!response.ok` and `response.status >= 400 && response.status < 500`:
     - Parse the error message via `getResponseError`.
     - Set `syncError` to the error message.
     - Set `failedMutationId` state to `mutation.id`.
     - **Do not** remove the mutation yet — user must confirm discard.
     - Break out of the mutation loop (do not continue to next mutation).
   - If `!response.ok` and status is 5xx or network error: throw (existing behavior — keeps mutation, sets `syncError`, does not set `failedMutationId`).

2. **New state: `failedMutationId`**:
   - `const [failedMutationId, setFailedMutationId] = useState("")`.
   - Reset to `""` at the start of a successful drain and after a discard.

3. **New callback: `discardFailedMutation`**:
   - Defined inside the component (not inside `useEffect`).
   - `async function discardFailedMutation(): Promise<void>`:
     - Guard: if `!failedMutationId` return early.
     - Call `await removeOfflineMutation(failedMutationId)`.
     - Call `setFailedMutationId("")` and `setSyncError("")`.
     - Call `void drainQueue()` to retry remaining items.
   - Pass as part of the context `value` object.

4. **Extend `OfflineQueueContextValue` type** in `types.ts`:
   ```ts
   failedMutationId: string;
   discardFailedMutation: () => Promise<void>;
   ```

5. **Update `OfflineBanner.tsx`**:
   - Read `failedMutationId` and `discardFailedMutation` from `useOfflineQueue()`.
   - When `failedMutationId` is non-empty: render a `<button>` after the message paragraph that calls `void discardFailedMutation()` on click.
   - Use the i18n key `"offline.discard"` for the button label.

6. **i18n keys** (both locales):
   - `"offline.discard"`: `"Ausstehende Änderung verwerfen"` (de), `"Discard queued change"` (en).

### Files
| File | Change |
|------|--------|
| `frontend/src/context/OfflineQueueContext.tsx` | 4xx detection, `failedMutationId` state, `discardFailedMutation` callback, expose in context value |
| `frontend/src/types.ts` | Extend `OfflineQueueContextValue` with `failedMutationId: string` and `discardFailedMutation: () => Promise<void>` |
| `frontend/src/components/OfflineBanner/OfflineBanner.tsx` | Render discard button when `failedMutationId` non-empty |
| `frontend/src/locales/de/translation.json` | Add `"offline.discard"` key |
| `frontend/src/locales/en/translation.json` | Add `"offline.discard"` key |
| `frontend/src/context/OfflineQueueContext.test.tsx` | Tests for 4xx error path and `discardFailedMutation` |
| `frontend/src/components/OfflineBanner/OfflineBanner.test.tsx` | New file: test discard button rendering and click |

### Acceptance Criteria
- A 4xx response sets `syncError` + `failedMutationId`; mutation stays in queue.
- A 5xx response keeps existing retry behavior; `failedMutationId` stays empty.
- Clicking "Discard queued change" removes the mutation, clears error state, and re-drains remaining queue items.
- Both locale files contain `offline.discard`.
- `OfflineQueueContextValue` type is complete and matches the provider's value object.

---

## Validation Before Commit
```
npm run lint
npm run build
npm test
```
