# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **complete**

Reviewed: 2026-05-27

#### Findings

No issues found.

#### Verification

##### Steps

1. Read `.ai/PLAN.md` and `.ai/TASKS.md` to confirm scope.
2. Read `frontend/src/context/OfflineQueueContext.tsx` (full file) and `git diff HEAD` for the implementation diff.
3. Read `frontend/src/context/OfflineQueueContext.test.tsx` (new test file).
4. Verified all three plan requirements against code:
   - `isSyncingRef` guard: set synchronously before `try`, cleared in `finally`, guard at top of `drainQueue()`. ✅
   - `visibilitychange` listener: registered, checks `document.visibilityState === "visible" && navigator.onLine`, removed in cleanup. ✅
   - `handleQueueChanged` extended: calls `drainQueue()` when `navigator.onLine`. ✅
5. Ran `npm run lint` — 0 errors, 1 pre-existing warning in `AuthContext.tsx` (unrelated).
6. Ran `npm run build` — successful, no new warnings.
7. Ran `npm test` — 164 tests, 0 failures.

##### Findings

- **Lint**: clean on all changed files; one pre-existing warning in `AuthContext.tsx` is unrelated to T-001.
- **Build**: clean.
- **Tests**: 3 new tests cover all acceptance criteria:
  - `drains queued mutations when the page becomes visible while online` ✅
  - `drains newly queued mutations when the queue changes while online` ✅
  - `does not start a second drain while a drain is already running` ✅
- **Race-condition analysis**: `isSyncingRef.current = true` is set synchronously before any `await`, so two synchronous callers cannot both pass the guard — the guard is sound.
- **Early-return path**: when `pendingMutations.length === 0`, the function returns inside `try`, so `finally` still resets `isSyncingRef.current = false` and calls `refreshQueuedCount()`. Correct behaviour.
- **Cleanup**: `document.removeEventListener("visibilitychange", handleVisibilityChange)` is present in the effect cleanup. No listener leak.

##### Risks

- Low: the redundant `refreshQueuedCount()` call (once from `handleQueueChanged`, once from `drainQueue`'s `finally`) is harmless; both resolve to the same state.

#### Verdict

`PASS`

---

## Task: T-002

### Review Round 1

Status: **complete**

Reviewed: 2026-05-27

#### Findings

No issues found.

#### Verification

##### Steps

1. Re-read `.ai/PLAN.md` and `.ai/TASKS.md` to confirm scope.
2. Read full `git diff HEAD` across all 5 changed source files and 2 new test files.
3. Read complete `OfflineQueueContext.tsx`, `OfflineBanner.tsx`, `OfflineQueueContext.test.tsx`, `OfflineBanner.test.tsx`, `types.ts`, both locale files.
4. Verified all plan acceptance criteria against the code:
   - **4xx path**: `response.status >= 400 && response.status < 500` sets `syncError` + `failedMutationId(mutation.id)`, sets `blockedByFailedMutation = true`, breaks the loop. Mutation stays in queue. ✅
   - **5xx / network error path**: falls through to `throw new Error(responseError)` → `catch` sets `syncError` only; `failedMutationId` unchanged (empty). ✅
   - **`discardFailedMutation`**: guards on `failedMutationId`, removes mutation, clears both state fields, re-drains. ✅
   - **`blockedByFailedMutation` flag**: correctly suppresses `setSyncVersion` / `OFFLINE_SYNC_COMPLETE_EVENT` when drain halted by 4xx. ✅
   - **`failedMutationId` reset**: cleared at drain start (empty queue path and non-empty path). ✅
   - **`useCallback` refactor**: `drainQueue` and `refreshQueuedCount` are stable refs (`[]` deps) — `useEffect([drainQueue, refreshQueuedCount])` runs exactly once. No re-mount loop risk. ✅
   - **OfflineBanner**: Fragment wraps `<p>` + conditional discard `<button>`. Button label uses `t("offline.discard")`. ✅
   - **Locale keys**: `"offline.discard"` present in both `en/translation.json` and `de/translation.json` with correct values. ✅
   - **`OfflineQueueContextValue`**: `failedMutationId: string` and `discardFailedMutation: () => Promise<void>` added. ✅
5. Ran `npm run lint` — 0 errors on changed files; 1 pre-existing warning in `AuthContext.tsx`.
6. Ran `npm run build` — clean.
7. Ran `npm test` — frontend: 6 `OfflineQueueContext` tests (3 T-001 + 3 T-002) ✅, 1 `OfflineBanner` test ✅, all other suites green. Backend: 164/164 pass.

##### Findings

- **Lint**: clean on all changed files.
- **Build**: clean.
- **Tests**: all new tests pass and cover every acceptance-criteria branch:
  - `keeps a failed mutation in the queue and exposes it for discard after a 4xx response` ✅
  - `keeps retry behavior for 5xx responses without exposing a failed mutation` ✅
  - `discards the failed mutation, clears the error, and drains remaining queued mutations` ✅
  - `renders the discard action for a non-retriable failed mutation` (OfflineBanner) ✅

##### Risks

- Low: `removeOfflineMutation` in the real store also fires `OFFLINE_QUEUE_CHANGED_EVENT`, which triggers `handleQueueChanged → drainQueue`. Combined with the explicit `void drainQueue()` in `discardFailedMutation`, two drain attempts race. The `isSyncingRef` guard ensures only one proceeds — this is the same guard proven correct in T-001.

#### Verdict

`PASS`
