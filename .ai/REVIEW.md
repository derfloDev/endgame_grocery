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

---

## Task: T-003

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-29

#### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `index.css` `.add-item-icon-browser-inner` | `overflow-clip-margin: 12px` is used; the plan specified 4px. 12px gives more room for the cyan glow and degrades gracefully (clip without margin) on older Safari < 17. | No |
| 2 | nit | `index.css` `.bottom-sheet` | Adds `overflow-x: hidden` — not in the plan but a sensible belt-and-suspenders addition alongside `html { overflow-x: hidden }`. | No |

#### Verification

##### Steps
1. Reviewed `git diff HEAD` for `frontend/src/index.css` and `frontend/src/components/AddItemSheet.test.jsx`.
2. Cross-referenced all four acceptance criteria against the diff.
3. Verified `overflow: clip` + `overflow-clip-margin` browser support (Chrome 90 / Firefox 102 / Safari 17; degrades to clipped shadow on older).
4. Ran `npm run lint` — 0 errors, 1 pre-existing warning.
5. Ran `npm run build` — clean.
6. Ran `npm test` — 51 frontend tests (AddItemSheet +1 new test + 1 updated assertion); 98 backend; 0 failures.

##### Findings

**AC: FAB fully visible with ≥ 16 px right margin on ≤ 375 px screens**
`right: max(calc(50% - 195px), 16px)`. At 375 px: `50% - 195px = −7.5px`; `max(−7.5px, 16px) = 16px`. New test asserts the CSS rule by regex. ✅

**AC: Icon-search glow not clipped**
`.add-item-icon-browser-inner` changed from `overflow: hidden` (creates scroll container, clips shadows) to `overflow: clip` (layout-only clip) with `overflow-clip-margin: 12px` (allows shadow bleed). Also adds `padding: 4px 4px 0` (replaces previous `padding-top: 4px`, adds 4px side clearance). Test asserts `overflow: clip`, `overflow-clip-margin: 12px`. ✅

**AC: No border-top divider above icon-browser search field**
`border-top: 1px solid rgba(255, 255, 255, 0.05)` removed from `.add-item-icon-browser-inner`. Test asserts `iconBrowserInnerRule` does not match `border-top:`. ✅

**AC: No scrollbar flash on icon-browser collapse**
Three-layer defence:
- `html { overflow-x: hidden }` — prevents viewport-level transient overflow;
- `.bottom-sheet { overflow-x: hidden }` — containment at sheet level;
- `.add-item-icon-browser { overflow: clip; contain: layout }` — prevents content escaping the grid-row animation boundary.
Test asserts `html { overflow-x: hidden }` and `contain: layout` on the browser element. ✅

**`overflow: clip` on `.bottom-sheet--browser-open .add-item-icon-browser-inner`**
Also changes `overflow: hidden` → `overflow: clip` in the browser-open variant, consistent with the base rule. ✅

##### Risks
- Low: `overflow-clip-margin` requires Safari 17+ (2023). On Safari 16 the glow reverts to clipped — previous behaviour, not a regression.
- Low: `contain: layout` is well-supported but creates a new containing block; this is intentional and already scoped to the icon browser element.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-29

#### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `ShareListSheet.jsx` line 37, `index.css` | `eg-success-banner` class is used on the share-notice banner but has no CSS definition (only `.eg-error-banner` and `.eg-chip-success` exist). The notice text renders unstyled (just `.detail-banner` margin). **Pre-existing issue, not introduced by T-002** — the class was already present before this task's changes. | No (pre-existing) |
| 2 | nit | `index.css` `.add-item-actions` | `margin-top: -8px` is a negative-margin trick to reduce the form-grid gap from 16 px to ≈ 8 px between the disclosure wrapper and the button row. Correct and tested, but slightly fragile if the parent `gap` ever changes. | No |

#### Verification

##### Steps
1. Read all changed files: `AddItemSheet.jsx`, `AddItemSheet.test.jsx`, `ShareListSheet.jsx`, `ShareListSheet.test.jsx`, `index.css` (diff), `ListDetailPage.test.jsx`.
2. Cross-referenced each acceptance criterion against the implementation.
3. Ran `git diff HEAD` to confirm exact CSS and JSX changes.
4. Ran `npm run lint` — 0 errors, 1 pre-existing warning in `AuthContext.jsx`.
5. Ran `npm run build` — clean.
6. Ran `npm test` — 50 frontend tests (AddItemSheet +1 new, ShareListSheet new, ListDetailPage.test.jsx new) + 98 backend; 0 failures.

##### Findings

**AC: Owner→Enable-notifications gap ≈ 12 px**
`.detail-meta` now has `display: flex; flex-direction: column; gap: var(--space-3)`. `--space-3` is 12 px per the design tokens. `ListDetailPage.test.jsx` asserts the CSS rule. ✅

**AC: Mehr-anzeigen→Cancel gap ≈ 8 px**
The toggle button and icon-browser are now wrapped in `.add-item-disclosure`. Closed state: `gap: 0` (disclosure collapses its own internal gap); the 16 px form-grid gap between the disclosure and the button-row is offset by `.add-item-actions { margin-top: -8px }`, giving a net ≈ 8 px. Open state: `gap: var(--space-2)` (8 px between toggle and browser). CSS assertions in `AddItemSheet.test.jsx` cover all three rules. ✅

**AC: Send-Invite→notice gap consistent**
Banners are now wrapped in `.share-list-sheet-feedback { display: grid; gap: var(--space-3); margin-top: var(--space-3); }` giving 12 px between the form and the feedback area. `ShareListSheet.test.jsx` asserts the wrapper and CSS rule. ✅

**AC: Add-item input scrolls into view when keyboard opens on mobile**
`handleInputFocus` calls `event.target.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })`. Optional-chaining guards against environments without the method. `AddItemSheet.test.jsx` mocks `scrollIntoView` and asserts it is called with the correct options. ✅

**Behaviour preservation**
The `handleInputFocus` change is additive: `scrollIntoView` is prepended, the existing `setShowSuggestions` branch is unchanged. All 11 prior `AddItemSheet` tests continue to pass. ✅

##### Risks
- Low: The `scrollIntoView` call fires on every focus event (including programmatic focus and desktop focus). On desktop, `scrollIntoView({ block: 'nearest' })` is a no-op if the element is already visible, so there is no visible side-effect.
- Low: Negative `margin-top: -8px` on `.add-item-actions` is tied to the parent grid gap being exactly 16 px. If `add-item-form` gap changes, this offset will need adjustment.

#### Open Questions
- None.

#### Verdict
`PASS`
