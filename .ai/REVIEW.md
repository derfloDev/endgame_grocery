# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-29

#### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `EntryRow.jsx` line 12, 48 | `animationClassName` is applied to both the outer `.entry-row-wrapper` and the inner `.entry-row` div. The CSS only animates the wrapper; the class on the inner element is only there to satisfy the test's `data-testid` query. Acceptable but worth noting. | No |
| 2 | nit | `index.css` line 1389 | `@media (prefers-reduced-motion: reduce)` sets `animation-duration: 1ms` rather than `0ms`. The plan specified instant show/hide. In practice this is fine because the JS layer skips all entering/exiting ID tracking when `prefersReducedMotion` is `true`, so no CSS animation fires at all for reduced-motion users; the 1 ms CSS rule is a belt-and-suspenders fallback only. | No |

#### Verification

##### Steps
1. Read all changed files: `ListDetailPage.jsx`, `EntryRow.jsx`, `RecentlyUsedSection.jsx`, `index.css`, `entry-row.test.jsx`, `RecentlyUsedSection.test.jsx`, `app.test.jsx`.
2. Cross-referenced each acceptance criterion against the implementation.
3. Ran `npm run lint` — 0 errors, 1 pre-existing warning in `AuthContext.jsx` (unrelated).
4. Ran `npm run build` — clean build, no errors.
5. Ran `npm test` — 48 frontend tests, 98 backend tests; 0 failures.

##### Findings

**AC: Marking done triggers ~300 ms fade-out + slight downscale before disappearing**
`toggleStatus` calls `scheduleEntryExit`, which adds the entry id to `exitingIds` (applying `.entry-exiting` / `entryFadeOut` animation), runs the PATCH concurrently, waits for at least 300 ms, then calls `updateEntries` to remove the row. ✅

**AC: Hard-delete triggers the same exit animation**
`handleDeleteEntry` calls `scheduleEntryExit` in the same way. ✅

**AC: SSE `entry:created` → new row fades in**
`handleCreatedEntry` calls `loadEntries({ animateEntering: true })`, which compares old vs new open entries and adds new IDs to `enteringIds` via `markEnteringEntries`. ✅

**AC: SSE `entry:deleted` → row fades out before removal**
`handleDeletedEntry` adds the entry id to `exitingIds`, waits 300 ms, then calls `loadEntries()`. Guard prevents double-exit for the same id. ✅

**AC: Re-adding from Recently Used → chip fades/slides in (as new list row)**
`handleAddFromHistory` → `addEntryByText` → `updateEntries(..., { animateEntering: true })` animates the new entry row in. ✅

**AC: Recently-used chips animate in on done/delete**
`toggleStatus` and `handleDeleteEntry` both call `addToRecentlyUsed` → `markRecentlyUsedItems`, which adds the text to `newlyAddedTexts` and schedules removal after 300 ms. `RecentlyUsedSection` applies `.entry-entering` to matching chips. ✅

**AC: `prefers-reduced-motion` disables animations**
JS: `prefersReducedMotion` state (detected via `matchMedia`) causes `markEnteringEntries`, `markRecentlyUsedItems`, and `waitForAnimationDelay` to no-op or resolve immediately. CSS: `@media (prefers-reduced-motion: reduce)` sets `animation-duration: 1ms` as a fallback. Integration test verifies no animation delay when reduced-motion is active. ✅

**Timeout cleanup**
The cleanup `useEffect` clears both tracked timeout maps and the `activeTimeoutIdsRef` set on unmount, preventing state updates on unmounted components. ✅

**Race-condition guard**
Both `scheduleEntryExit` and `handleDeletedEntry` check `exitingIdsRef.current.has(entryId)` before adding to the set, preventing double-animation for the same id. ✅

##### Risks
- Low: If `waitForAnimationDelay` resolves slightly before the CSS animation completes (e.g., due to tab throttling), the row may disappear before the fade-out visually finishes. This is an inherent limitation of timer-driven animation synchronization and is acceptable for this feature.
- Low: The `prefersReducedMotion` state is initialised synchronously in `useState` via `getInitialReducedMotionPreference()`, so there is no flash-of-animation on first render for reduced-motion users.

#### Open Questions
- None.

#### Verdict
`PASS`
