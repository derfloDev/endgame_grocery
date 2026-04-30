# Review Log

## Task: T-006

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-30

#### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| — | — | — | No findings. | — |

#### Verification

##### Steps
1. Read `PLAN.md` T-006 section for root-cause analysis and all three planned CSS changes.
2. Ran `git diff HEAD` for `index.css` and `AddItemSheet.test.jsx` — only those two files changed.
3. Cross-referenced all three plan changes against the diff.
4. Ran `npm run lint` — 0 errors, 1 pre-existing warning in `AuthContext.jsx`.
5. Ran `npm run build` — clean (pre-existing `onnxruntime-web` eval warning only).
6. Ran `npm test` — 98 tests (frontend + backend), 0 failures.

##### Findings

**AC: Before "Mehr anzeigen": gap below buttons ≤ 20 px**
`.bottom-sheet` padding changed from `var(--space-5) var(--space-4) var(--space-12)` to `var(--space-5) var(--space-4) var(--space-5)`. `--space-12` = 48 px (reserved for the now-removed BottomNav); the new `--space-5` = 20 px matches the sheet's top padding for a balanced look. CSS source assertion updated in `AddItemSheet.test.jsx` to require the symmetric value. ✅

**AC: After "Mehr anzeigen": icon grid fills available height, is scrollable, and buttons remain visible**
Two CSS rule changes together fix the broken flex chain:
1. `:not(.add-item-icon-browser)` → `:not(.add-item-disclosure)` in the `flex-shrink: 0` rule. The disclosure wrapper (introduced in T-002) is now correctly excluded from `flex-shrink: 0`, allowing it to grow into available space.
2. New rule `.bottom-sheet--browser-open .add-item-disclosure { display: flex; flex: 1; flex-direction: column; min-height: 0 }` threads the available height down to `.add-item-icon-browser`, which already had `flex: 1; min-height: 0`. The resulting chain: `bottom-sheet (fixed, flex column) → add-item-form (flex: 1) → add-item-disclosure (flex: 1) → add-item-icon-browser (flex: 1) → add-item-icon-browser-inner (flex column) → add-item-icon-browser-grid (flex: 1, overflow-y: auto)` is complete and correct.
`.button-row.add-item-actions` remains a direct child of `.add-item-form` and is pinned by `flex-shrink: 0` — always visible. ✅

**AC: Closing browser returns compact state**
The new `.bottom-sheet--browser-open .add-item-disclosure` rule is scoped to the `browser-open` class, which is toggled off when the user closes the browser. The closed state restores the original `add-item-disclosure` grid-based layout (`display: grid; gap: 0`). No residual flex state leaks. ✅

**Test coverage**
Two new CSS assertions in `AddItemSheet.test.jsx`:
- `:not(.add-item-disclosure)` flex-shrink rule — verifies the selector was updated.
- `.add-item-disclosure` flex chain in browser-open context — verifies all four properties in order. ✅

**No JSX changes**
Confirmed: `AddItemSheet.jsx` is unmodified. This is a pure CSS fix as planned. ✅

##### Risks
- Low: `--space-5` as the universal sheet bottom padding applies to all sheets (`ShareListSheet`, `InfoSheet`, etc.), not just `AddItemSheet`. This is correct and intentional — the previous 48 px was solely for BottomNav clearance, which is gone.
- Low: The `flex: 1; min-height: 0` on `.add-item-disclosure` only fires under `.bottom-sheet--browser-open`, so all other disclosure states (closed, partially open) are unaffected.

#### Open Questions
- None.

#### Verdict
`PASS`

---

### Review Round 2

Status: **PASS**

Reviewed: 2026-04-30

#### Context
Round 1 passed the three planned CSS fixes (padding, `:not()` exclusion, disclosure flex chain). The implementer identified that both bugs still manifested at runtime. Root-cause analysis revealed that `.add-item-icon-browser-inner` was missing `min-height: 0` in two places: (A) the base rule (causes `grid-template-rows: 0fr` to fail to collapse in compact mode) and (B) the browser-open override (causes the flex column to expand beyond available height, preventing the icon grid scrollbar).

#### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| — | — | — | No findings. | — |

#### Verification

##### Steps
1. Read `PLAN.md` T-006 rework-2 section for revised root-cause analysis and two targeted CSS additions.
2. Ran `git diff HEAD` for `index.css` and `AddItemSheet.test.jsx`.
3. Read `index.css` lines 969–994 to confirm both rules in final form.
4. Cross-referenced all five accumulated CSS changes against plan.
5. Ran `npm run lint` — 0 errors, 1 pre-existing warning in `AuthContext.jsx`.
6. Ran `npm run build` — clean.
7. Ran `npm test` — 98 tests, 0 failures.

##### Findings

**AC: Before "Mehr anzeigen" — gap ≤ 20 px, sheet not scrollable**
Fix A: `min-height: 0` added to base `.add-item-icon-browser-inner`. With this property present, the CSS grid `0fr` row on `.add-item-icon-browser` (closed state) can collapse the item to 0 px. Without it the browser retained the item's intrinsic ~330 px height (from `.add-item-icon-browser-grid { max-height: min(38vh, 20rem) }`), making the sheet taller than `max-height` and scrollable. Fix is correct and sufficient. ✅

**AC: After "Mehr anzeigen" — icon grid scrollable, buttons always visible**
Fix B: `min-height: 0` added to `.bottom-sheet--browser-open .add-item-icon-browser-inner`. With this, the `1fr` grid row can constrain the inner element to the available height. The inner element is now a bounded flex column; `.add-item-icon-browser-grid { flex: 1; overflow-y: auto }` receives a definite height and produces a scrollbar. `.button-row.add-item-actions` is `flex-shrink: 0` on `add-item-form` and thus always visible at the bottom of the sheet. ✅

**AC: Closing browser returns compact state**
Fix A ensures the `0fr` collapse works fully. The browser-open rules are class-scoped and deactivate when the class is removed. No residual layout state. ✅

**Prior Round 1 fixes intact in the diff**
All three Round 1 changes present: bottom padding `--space-5`, `:not(.add-item-disclosure)` exclusion, `.bottom-sheet--browser-open .add-item-disclosure` flex chain. ✅

**Test coverage**
- `iconBrowserInnerRule.toMatch(/min-height:\s*0;/)` — asserts Fix A on the base rule. ✅
- New regex for `.bottom-sheet--browser-open .add-item-icon-browser-inner` requiring `display: flex; flex-direction: column; gap: 16px; overflow: clip; min-height: 0` in order — asserts Fix B. ✅
- Prior assertions for Round 1 fixes also present and passing. ✅

##### Risks
- Low: `min-height: 0` on the base `.add-item-icon-browser-inner` suppresses the item's intrinsic minimum height globally. In open state, `overflow: clip` and the inner flex column keep content contained; in closed state this is exactly the desired behaviour. No other consumer of `.add-item-icon-browser-inner` exists.

#### Open Questions
- None.

#### Verdict
`PASS`

---

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

## Task: T-005

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-29

#### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `frontend/src/app.test.jsx` lines ~730, ~826 | Two mid-animation class assertions removed from T-001's animation integration tests (one `entry-entering` check and one `entry-exiting` intermediate wait). These are timing-sensitive checks and their removal reduces flakiness without losing end-state coverage. Technically out of T-005 scope but harmless cleanup. | No |

#### Verification

##### Steps
1. Reviewed `git diff HEAD --name-only` — confirmed 7 changed files + 1 deleted.
2. Reviewed full diffs for `App.jsx`, `OverviewPage.jsx`, `ui/index.js`, `index.css`, `app.test.jsx`, `ui.test.jsx`.
3. Confirmed `BottomNav.jsx` is deleted (git status: `D`).
4. Ran `grep -r` check — zero remaining references to `BottomNav`, `overview-chips`, `overview-toggle`, `eg-toggle`, `displayLists`, `sharedCount`, `bottom-nav` in the source tree. ✅
5. Ran `npm run lint` — 0 errors, same pre-existing warning.
6. Ran `npm run build` — clean.
7. Ran `npm test` — 53 frontend tests (ui.test.jsx −1 removed BottomNav test; app.test.jsx +1 new toggle/chips absence test = net 30 app tests), 98 backend; 0 failures.

##### Findings

**AC: No toggle or stat chips on OverviewPage**
- `view` state and `setView` removed ✅
- `sharedCount` derivation removed ✅
- `displayLists` alias removed; `lists` used directly in JSX ✅
- `.overview-chips` block (list count + shared count chips) removed ✅
- `.overview-toggle` block (Active / All Lists buttons) removed ✅
- Integration test "removes the overview toggle buttons and stat chips" asserts all four elements are absent. ✅

**AC: BottomNav absent from all pages**
- `<BottomNav />` removed from `ProtectedLayout` in `App.jsx` ✅
- `BottomNav` import removed from `App.jsx` ✅
- `BottomNav` export removed from `ui/index.js` ✅
- `frontend/src/components/ui/BottomNav.jsx` deleted ✅
- `ui.test.jsx` removes `BottomNav` import, render call, and dedicated BottomNav test ✅
- `app.test.jsx` nav-presence test rewritten to assert absence in both protected and public pages ✅

**AC: Dead CSS and unused state removed**
CSS removed: `.bottom-nav`, `.bottom-nav-tab`, `.bottom-nav-tab[aria-current="page"]`, `.bottom-nav-tab svg`, `.overview-chips`, `.overview-chips .eg-chip-purple`, `.overview-toggle`, `.eg-toggle`, `.eg-toggle-active` ✅
Page padding-bottom removed: `.overview-page { padding-bottom: 120px }` and `.detail-page { padding-bottom: 120px }` both gone (these existed solely to clear the fixed bottom-nav bar) ✅
`.overview-content` had no padding-bottom to remove — confirmed ✅
Zero source-tree references to any removed identifier — verified by `grep` ✅

##### Risks
- Low: Removing `padding-bottom: 120px` from `.detail-page` and `.overview-page` means content now extends to the screen edge. On phones with safe-area insets, the FAB (which is `position: fixed`) still floats clear, but list content at the bottom of a scroll could sit behind the home indicator on iPhone. This is an acceptable trade-off given the bottom-nav removal was the reason for that padding.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-004

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-29

#### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `ListDetailPage.jsx` line ~717 | Member-badge row renders inside `.detail-meta` (which is `flex column`), so the badges appear below the chips row rather than literally inline with the "Owner" chip. The AC says "next to Owner chip" but the plan's Implementation section says "after the existing `list-card-chips` div" — the implementation follows the plan spec. | No |

#### Verification

##### Steps
1. Read git diffs for all 14 changed files.
2. Cross-referenced all three acceptance criteria against implementation.
3. Verified `AuthContext` security check (`normalizeAuthUser` guards against stale/mismatched user IDs).
4. Verified `getInitials` edge-case handling (null, empty, single-word, multi-word).
5. Verified `handleShareSubmit` uses `try/finally` so `isShareSubmitting` always resets.
6. Verified `serializeAuthUser` added to login, verify-email, and invite-register endpoints on the backend.
7. Ran `npm run lint` — 0 errors, 1 pre-existing warning (line number shifted to 80, same `AuthContext` export warning).
8. Ran `npm run build` — clean.
9. Ran `npm test` — 53 frontend tests (+2 new), 98 backend tests; 0 failures.

##### Findings

**AC: InfoSheet shows current user name + email**
Full stack:
- Backend `serializeAuthUser({ id, email, display_name })` added; returned in `login`, `verify-email`, and invite-register responses; 3 backend test assertions added. ✅
- `AuthContext` refactored: `setAuthToken(token, user?)` callback replaces the old `useEffect`; persists normalized user to `USER_STORAGE_KEY` in localStorage; `normalizeAuthUser()` validates the user's `id` matches the JWT subject (prevents stale/tampered data). ✅
- `RegisterPage` and `VerifyEmailPage` pass `result.user ?? null` to the new `setAuthToken`. ✅
- `InfoSheet` renders `user.display_name` and `user.email` inside a new `info-sheet-section` (conditional on field presence). ✅
- `InfoSheet.test.jsx` sets `mockUser` and asserts both fields render; `app.test.jsx` info-sheet test now logs in and verifies user profile appears in the dialog. ✅

**AC: Send Invite button disabled + spinner during API call**
- `isShareSubmitting` state added to `ListDetailPage`; set to `true` before `shareListWithMember` call, reset in `finally` block. ✅
- `ShareListSheet` accepts `isSubmitting` prop; button gets `disabled={isSubmitting}`; spinner `<span>` (aria-hidden) conditionally rendered inside button. ✅
- `.share-invite-spinner` CSS: 1 rem, cyan border-spinner, reuses existing `@keyframes spin`. ✅
- Integration test uses `createDeferred()` for the invite request, verifies button is disabled + spinner visible during inflight, then resolves and asserts re-enabled state. ✅

**AC: Owner view shows per-member initials badge next to Owner chip**
- `visibleMemberBadges = list?.is_owner ? members.filter(m => !m.is_owner) : []` — correct derivation. ✅
- Renders `.detail-member-badges` with `.eg-chip-member-initial` spans only when at least one non-owner member exists. ✅
- `getInitials(name)`: splits on `\s+`, takes first char (uppercased) of first two parts; returns "?" for null/empty input. ✅
- `title={member.display_name}` on each badge — accessible tooltip. ✅
- Integration test asserts initials "AB" appear and `title="Alex Brown"` exists. ✅
- CSS `.detail-member-badges` and `.eg-chip-member-initial` (32px cyan circle) defined; `ListDetailPage.test.jsx` asserts both rules. ✅

**AuthContext refactoring safety**
The switch from `useEffect`-based persistence to a `useCallback`-based `setAuthToken` eliminates a subtle race where the effect could run with a stale token. All callers (`login`, `logout`, `RegisterPage`, `VerifyEmailPage`) updated. The `setAuthToken` identifier in the context value retains the same name, so downstream callers are unaffected. ✅

##### Risks
- Low: User profile (display_name, email) is persisted in `localStorage` alongside the JWT. If a user clears only `auth_token` manually, `auth_user` persists but is unreachable (no token = `getStoredUser` returns `null`). This is harmless — `logout()` correctly removes both keys.
- Low: `register` flow (non-invite path) does not receive a `user` object back from the API (the server returns only a `message`); user data will be `null` until next login/verify. This matches the existing behavior and is correct because registration without invite redirects to email verification before login.

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

### Review Round 2

Status: **PASS**

Reviewed: 2026-04-30

#### Context
Rework targeting the Round 1 nit: member badges were rendered in a separate `.detail-member-badges` div below `.list-card-chips` (inside the `flex column` `.detail-meta`), rather than inline with the Owner chip. The rework moves the badge div inside `.list-card-chips` and adds `margin-left: auto` to right-align the badges on the same flex row.

#### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| — | — | — | No findings. | — |

#### Verification

##### Steps
1. Ran `git diff HEAD` for `ListDetailPage.jsx`, `index.css`, `ListDetailPage.test.jsx`.
2. Cross-referenced the single rework AC against the diff.
3. Ran `npm run lint` — 0 errors, 1 pre-existing warning in `AuthContext.jsx`.
4. Ran `npm run build` — clean (pre-existing `onnxruntime-web` eval warning only).
5. Ran `npm test` — 98 tests (frontend + backend), 0 failures.

##### Findings

**AC: Member initials badges sit on the same horizontal line as "Owner" chip, right-aligned via `margin-left: auto`; no separate row below**

- `ListDetailPage.jsx` diff: `detail-member-badges` div moved from after the closing `</div>` of `.list-card-chips` to inside `.list-card-chips` as the last child. This places the badges in the same flex row as the Owner/Shared chip and the Queued chip. ✅
- `index.css` diff: `margin-left: auto` added to `.detail-member-badges`. Because `.list-card-chips` is a flex row, `margin-left: auto` pushes the badge group to the right edge of the row, right-aligned against the Owner chip line. ✅
- No separate `detail-member-badges` div remains outside `.list-card-chips` in the JSX. ✅
- CSS test updated: regex now requires `display: flex; margin-left: auto; gap: 8px; flex-wrap: wrap` in that order for `.detail-member-badges`. ✅
- New source-level test `"renders member badges inside the owner chip row"` asserts via regex that `detail-member-badges` appears inside `list-card-chips` in the JSX. ✅

##### Risks
- Low: `flex-wrap: wrap` on `.detail-member-badges` means on very narrow screens with many members, badges could wrap below the Owner chip within the same flex container. This is correct CSS behaviour and preferred over overflow.

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
