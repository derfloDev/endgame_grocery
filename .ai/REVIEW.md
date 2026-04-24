# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001 — Design Tokens & App Shell

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-23

#### Findings

No blocking or major findings.

- **nit** — `frontend/src/index.css` includes `.auth-layout`, `.auth-card`, and related auth CSS classes that are scoped to T-003. Including them in T-001 is benign (no conflicts, tests pass), but slightly ahead of the task boundary.
- **nit** — `frontend/src/components/ui/BottomNav.jsx` uses inline SVG paths rather than the shared `Icon` component specified in the plan. Acceptable since the `Icon` component is created in T-002; no regression.
- **nit** — `SearchPage` stub goes slightly beyond `return null` (renders a `<div aria-label="Search page">`) which is required for the test assertion. Correct choice by the implementer.

#### Verification

##### Steps
1. Read `.ai/TASKS.md` — T-001 status confirmed `ready_for_review`.
2. Read `.ai/PLAN.md` — reviewed T-001 spec in full.
3. Read all changed files against plan: `frontend/index.html`, `frontend/src/styles/tokens.css`, `frontend/src/index.css`, `frontend/src/App.jsx`, `frontend/src/components/ui/BottomNav.jsx`, `frontend/src/pages/SearchPage.jsx`, `frontend/src/components/OfflineBanner.jsx`, `frontend/src/app.test.jsx`.
4. Confirmed logo asset present via `Glob`.
5. Ran `npm run lint` — passes (1 pre-existing warning in `AuthContext.jsx`, 0 errors).
6. Ran `npm run build` — passes cleanly (Vite build, PWA precache).
7. Ran `npm test` — all 11 frontend tests pass, all 25 backend tests pass.
8. Verified `git diff HEAD -- frontend/` for scope of uncommitted changes.

##### Findings

**All acceptance criteria met:**

| Criterion | Result |
|---|---|
| App background dark navy `#080B1C` | ✅ `--bg-base: #080B1C` in tokens.css; applied to `html`, `body`, `.app-shell` |
| Google Fonts (Orbitron, Exo 2) load | ✅ `<link>` tags added to `index.html` as specified |
| Logo asset at `frontend/src/assets/endgame_grocery_logo.png` | ✅ File present |
| BottomNav on `/` and `/search`, absent on `/login` and `/register` | ✅ BottomNav inside `ProtectedLayout`; login/register outside; test confirms |
| `/search` route exists and does not crash | ✅ Route wired; SearchPage stub with `aria-label`; test confirms |
| `npm run lint` passes | ✅ 0 errors |
| `npm run build` passes | ✅ Clean build |
| `npm test` passes | ✅ 11/11 frontend, 25/25 backend |

##### Risks

- None. All changes are additive CSS/JSX with no logic mutations beyond removing the old `hero-card` wrapper in `ProtectedLayout`. Existing test suite fully covers the shell.

#### Verdict
`PASS`

---

## Task: T-002 — Shared UI Component Library

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-24

#### Findings

No blocking, major, or minor findings.

- **nit** — `BottomSheet` renders its backdrop as a `<button aria-label="Close sheet">` rather than a plain `<div>`. This is a deliberate accessibility improvement (keyboard-reachable close target) that diverges from the plan's plain `div`, and is strictly better. Not a concern.
- **nit** — `TopBar` action items accept `ariaLabel` and `label` fields beyond the plan's `{icon, onClick}`. Additive, non-breaking.

#### Verification

##### Steps
1. Re-read `.ai/TASKS.md` — T-002 confirmed `ready_for_review`.
2. Re-read T-002 section of `.ai/PLAN.md` for spec details.
3. Read all 9 new/modified files: `Icon.jsx`, `TopBar.jsx`, `FAB.jsx`, `BottomNav.jsx`, `EmptyState.jsx`, `LoadingState.jsx`, `ErrorState.jsx`, `BottomSheet.jsx`, `ui/index.js`.
4. Read `ui.test.jsx` — 3 tests covering all acceptance criteria.
5. Inspected `git diff HEAD -- frontend/src/index.css` — confirmed all required CSS classes for T-002 components present.
6. Inspected `git diff HEAD -- frontend/src/components/ui/` — all 9 files accounted for; `BottomNav.jsx` correctly refactored to use `Icon` component.
7. Ran targeted test: `npx vitest run src/components/ui/ui.test.jsx` → **3/3 pass**.
8. Ran `npm run lint` → **0 errors** (1 pre-existing warning in AuthContext).
9. Ran `npm run build` → **clean** (247 kB JS bundle).
10. Ran `npm test` → **14/14 frontend tests pass**, **25/25 backend tests pass**.

##### Findings

**All acceptance criteria met:**

| Criterion | Result |
|---|---|
| All 8 components render without errors | ✅ Test 1 in `ui.test.jsx` confirms |
| BottomNav active state responds to current route | ✅ Test 2 confirms `aria-current="page"` on active tab |
| BottomSheet opens/closes with slideUp animation | ✅ CSS `animation: slideUp 0.3s var(--ease-out)` present; Test 3 confirms close |
| Barrel export `ui/index.js` works | ✅ All 8 components importable from `.` |
| `npm run lint` passes | ✅ 0 errors |
| `npm run build` passes | ✅ Clean build |

**Plan compliance — detailed:**

| Component | Key spec points | Status |
|---|---|---|
| `Icon.jsx` | All 20 named icons present; props `name, size=20, color, strokeWidth=1.5` | ✅ |
| `TopBar.jsx` | Sticky, Orbitron 18px title, subtitle, back button, actions | ✅ |
| `FAB.jsx` | Fixed 56×56, gradient-brand, glow-purple, hover scale | ✅ |
| `BottomNav.jsx` | Refactored to use `Icon` component; active detection unchanged | ✅ |
| `EmptyState.jsx` | shoppingCart icon, Orbitron title, optional action button | ✅ |
| `LoadingState.jsx` | Shimmer rows, animationDelay per row | ✅ |
| `ErrorState.jsx` | "Mission Failed" Orbitron + error colour, Retry button | ✅ |
| `BottomSheet.jsx` | Renders null when closed, slideUp animation, drag handle | ✅ |

##### Risks

- None. Components are stateless or minimally stateful; no logic mutations to existing behaviour.

#### Verdict
`PASS`

---

## Task: T-003 — Auth Pages Redesign

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-24

#### Findings

No blocking, major, or minor findings.

- **nit** — `auth-brand-text` wrapper div used in JSX has no corresponding CSS rule. It serves purely as a structural wrapper; no rule is needed, and the plan did not define one either. Not a concern.
- **nit** — Logo asset was resized from 2048×2048 → 256×256 to satisfy Workbox's precache size limit. Pragmatic and correct; the build now succeeds cleanly. Not a concern.

#### Verification

##### Steps
1. Re-read `.ai/TASKS.md` — T-003 confirmed `ready_for_review`.
2. Re-read T-003 section of `.ai/PLAN.md`.
3. Read `frontend/src/pages/LoginPage.jsx` and `RegisterPage.jsx` in full.
4. Inspected `git diff --staged` for all changed files: `LoginPage.jsx`, `RegisterPage.jsx`, `index.css`, `app.test.jsx`, logo asset.
5. Ran `npm run lint` → **0 errors**.
6. Ran `npm run build` → **clean** (logo now 130 kB, within Workbox precache budget).
7. Ran `npm test` → **15/15 frontend + 25/25 backend tests pass**.

##### Findings

**All acceptance criteria met:**

| Criterion | Result |
|---|---|
| Dark `auth-card` on both pages | ✅ `<section className="auth-card">` present on login and register |
| Logo + Orbitron "ENDGAME/GROCERY" brand header | ✅ `auth-brand` block, logo img, "ENDGAME" in `.eg-orbitron .eg-gradient-text`, "GROCERY" sub |
| Neon input focus ring | ✅ All `<input>` have `className="eg-input"`; focus ring defined in T-001 CSS |
| Gradient primary button | ✅ `eg-btn-primary` uses `var(--gradient-brand)` |
| Form submission and error display remain functional | ✅ All handler logic unchanged; `eg-error-banner` replaces `error-banner` |
| `npm run lint` passes | ✅ 0 errors |
| `npm run build` passes | ✅ Clean build |

**Plan compliance — detailed:**

| Item | Plan spec | Status |
|---|---|---|
| Login h1 | "Welcome Back" | ✅ |
| Login subtitle | "Sign in to access your mission." | ✅ |
| Register h1 | "Join the Squad" | ✅ |
| Register subtitle | "Create your account to get started." | ✅ |
| `button-primary` → `eg-btn-primary` | Both pages | ✅ |
| `error-banner` → `eg-error-banner` | Both pages | ✅ |
| `muted-link` → `eg-link` | Both pages | ✅ |
| `<input>` → `className="eg-input"` | All inputs on both pages | ✅ |
| `field` → `eg-field` | All field wrappers | ✅ |
| `<p class="eyebrow">` removed | Both pages | ✅ |
| `<div class="page-copy">` removed | Both pages | ✅ |
| CSS: `.eyebrow` / `.page-copy` removed | `index.css` | ✅ |
| CSS: `.auth-brand`, `.auth-logo`, `.auth-brand-title`, `.auth-brand-sub`, `.auth-card h1`, `.auth-card > p` added | `index.css` | ✅ |
| Test updated for new heading copy | "Welcome Back" (capital B) | ✅ |
| New test for brand + copy on both auth pages | `app.test.jsx` | ✅ |

##### Risks

- None. All form logic, state management, and routing are unchanged. Only JSX structure and CSS class names were modified, covered by the existing + new tests.

#### Verdict
`PASS`

---

## Task: T-004 — Overview Page Redesign

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-24

#### Findings

No blocking, major, or minor findings.

- **nit** — `ListCardHome` uses `<article>` instead of the plan's `<div>` as the card root. Semantically more appropriate for a standalone content item. Not a concern.
- **nit** — `NewListSheet` uses a `<form onSubmit>` instead of an `onKeyDown` handler on the input. Functionally equivalent; the form approach is more robust (Enter key submits natively). Not a concern.
- **nit** — `BottomSheet` gained `aria-label={title}` on the dialog div — a correctness improvement that enabled `findByRole("dialog", { name: "New List" })` in tests. Positive change.
- **nit** — Active toggle applies both `eg-toggle eg-toggle-active` classes (not just `eg-toggle-active`). This is correct: `eg-toggle` supplies base padding/radius, `eg-toggle-active` overrides colours via CSS cascade.
- **nit** — The moreVertical menu button is only rendered for `list.is_owner === true`. The plan's spec omitted this guard, but the implementation is strictly more correct — non-owners cannot rename or delete, so showing the menu would be misleading.

#### Verification

##### Steps
1. Re-read `.ai/TASKS.md` — T-004 confirmed `ready_for_review`.
2. Re-read T-004 section of `.ai/PLAN.md`.
3. Read `OverviewPage.jsx`, `ListCardHome.jsx`, `NewListSheet.jsx` in full.
4. Inspected `git diff --staged` (new files: `ListCardHome.jsx`, `NewListSheet.jsx`) and `git diff` (unstaged: `OverviewPage.jsx`, `index.css`, `app.test.jsx`, `BottomSheet.jsx`).
5. Ran `npm run lint` → **0 errors**.
6. Ran `npm run build` → **clean** (250 kB JS).
7. Ran `npm test` → **17/17 frontend + 25/25 backend tests pass**.

##### Findings

**All acceptance criteria met:**

| Criterion | Result |
|---|---|
| Dark neon list cards with owner/shared chips | ✅ `ListCardHome` renders `eg-card`, `eg-chip-purple`/`eg-chip-cyan`, Queued chip |
| FAB opens `NewListSheet` bottom sheet | ✅ FAB `onClick={() => setShowNew(true)}`; test confirms dialog appears |
| Creating a list adds it to the list | ✅ `createListByName` → `updateLists`; offline queuing preserved |
| Rename & delete via moreVertical menu | ✅ Menu opens on owner cards; rename input + Save/Cancel; delete with confirm |
| Active/All toggle renders | ✅ `overview-toggle` with `eg-toggle` / `eg-toggle-active` |
| Empty / loading / error states display | ✅ `EmptyState`, `LoadingState`, `ErrorState` wired; new test covers loading + error |
| Logout functional | ✅ `eg-icon-btn` `aria-label="Log out"` calls `logout()`; test confirms redirect |
| `npm run lint` passes | ✅ 0 errors |
| `npm run build` passes | ✅ Clean |
| `npm test` passes | ✅ 17/17 frontend |

**Plan compliance — detailed:**

| Item | Status |
|---|---|
| State: `view`, `showNew` added | ✅ |
| `createListByName(name)` extracted | ✅ |
| `submitRename(listId, newName)` extracted (no state dependency) | ✅ |
| `handleDelete` unchanged | ✅ |
| `sharedCount` + `displayLists = lists` | ✅ |
| `loadLists` as `useCallback` for ErrorState retry | ✅ |
| `overview-topbar` sticky header with brand + chips | ✅ |
| `overview-toggle` Active / All Lists | ✅ |
| `overview-content` with all four states | ✅ |
| `FAB` + `NewListSheet` | ✅ |
| All required CSS classes | ✅ |
| New tests: loading/error states, logout | ✅ |
| Existing tests updated for new UI copy & interaction flow | ✅ |

##### Risks

- None. All async handlers, offline queue integration, and routing are unchanged. The state refactors (removing `editingId`/`editingName`, removing `newListName`) eliminate race conditions in the old implementation. Full test coverage.

#### Verdict
`PASS`

---

## Task: T-005 — List Detail Page Redesign

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-24

#### Findings

No blocking, major, or minor findings.

- **nit** — `EntryRow` touch handlers early-return when `editMode` is true. Defensive addition beyond the plan spec; prevents accidental swipe-delete during inline edit. Positive.
- **nit** — `AddItemSheet` uses `<form onSubmit>` instead of `onKeyDown` on input. Same benefit as T-004 `NewListSheet`. Not a concern.
- **nit** — FAB is guarded by `{list ? <FAB …> : null}` — not shown while loading or on error. Correct; adding to a null list would be a no-op. Not a concern.
- **nit** — Button labels are entry-specific: `"Mark Milk done"`, `"Edit Coffee"`. More accessible than generic `"Done"` / `"Edit"`.
- **nit** — `sortEntries` helper ensures open entries appear before done, sorted by `created_at`. Bonus quality-of-life improvement; not required by the plan.

#### Verification

##### Steps
1. Re-read `.ai/TASKS.md` — T-005 confirmed `ready_for_review`.
2. Re-read T-005 section of `.ai/PLAN.md`.
3. Read `ListDetailPage.jsx`, `EntryRow.jsx`, `AddItemSheet.jsx`, `entry-row.test.jsx` in full.
4. Inspected `git diff --staged` (new files) and `git diff` (modified: `ListDetailPage.jsx`, `index.css`, `app.test.jsx`) for scope.
5. Ran `npm run lint` → **0 errors**.
6. Ran `npm run build` → **clean** (252 kB JS).
7. Ran `npm test` → **19/19 frontend + 25/25 backend tests pass**.

##### Findings

**All acceptance criteria met:**

| Criterion | Result |
|---|---|
| TopBar with list name and back navigation | ✅ `TopBar title={list?.name ?? "List"} onBack={() => navigate("/")}` |
| FAB opens `AddItemSheet` | ✅ `setShowAddItem(true)`; test confirms dialog by role |
| Adding an item creates an entry | ✅ `addEntryByText` → `createEntry`; offline temp entry support preserved |
| Items toggle done/open with neon styling & strikethrough | ✅ `checkCircle` color switches on status; `entry-row-done` + `entry-row-text-done` classes |
| Swipe-to-delete (>80 px left) | ✅ Touch handlers; `entry-row.test.jsx` swipe test confirms `onDelete` called |
| Done section is collapsible | ✅ `doneOpen` state; collapse button; test confirms hide/show |
| Sharing panel (owner only) renders and functions | ✅ `SharingPanel` behind `list?.is_owner && isSharingOpen`; share + revoke tests pass |
| `npm run lint` passes | ✅ 0 errors |
| `npm run build` passes | ✅ Clean |
| `npm test` passes | ✅ 19/19 frontend |

**Plan compliance — detailed:**

| Item | Status |
|---|---|
| `addEntryByText(text)` extracted | ✅ |
| `submitEditEntry(entryId, text)` extracted | ✅ |
| `toggleStatus`, `handleDeleteEntry`, `handleShareSubmit`, `handleRevokeMember` preserved | ✅ |
| State: `showAddItem`, `doneOpen` added | ✅ |
| `openEntries` / `doneEntries` derived | ✅ |
| OPEN ITEMS section with EmptyState when empty | ✅ |
| Done section conditional + collapsible | ✅ |
| `SharingPanel` as local named function | ✅ |
| `EntryRow`: swipe zone, touch handlers, check/edit/delete buttons | ✅ |
| `EntryRow`: inline edit mode with Save/Cancel | ✅ |
| `AddItemSheet`: does NOT auto-close after add | ✅ |
| Dedicated swipe test in `entry-row.test.jsx` | ✅ |
| New integration tests: TopBar elements, collapsible done, loading/error | ✅ |
| Existing detail tests updated for new UI | ✅ |

##### Risks

- None. All async handlers, API calls, and offline queue integration are unchanged. New components are well-isolated and fully covered by the dedicated + integration test suite.

#### Verdict
`PASS`

---

## Task: T-007 — List Detail Options Flyout + BottomNav Cleanup

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-24

#### Findings

No blocking, major, or minor findings.

- **nit** — `ListOptionsSheet` guards with `if (!open || !isOwner)`. The `!isOwner` check is redundant (the parent never sets `showOptions=true` for non-owners, and the options button only renders for owners) but is a safe belt-and-suspenders guard.
- **nit** — `ShareListSheet` uses `<label htmlFor="share-list-sheet-email">` wrapping the input, making `htmlFor` technically redundant (implicit association via nesting suffices). Accessible and functional either way; `getByLabelText` works as confirmed by passing tests.
- **nit** — `RenameListSheet` disables Save when `value.trim() === currentName`. This is a UX improvement beyond the spec — prevents no-op API calls. Positive.
- **nit** — `handleRename` re-throws on error so `RenameListSheet` can stay open on failure. Correct defensive pattern.

#### Verification

##### Steps
1. Re-read `.ai/TASKS.md` — T-007 confirmed `ready_for_review`.
2. Re-read T-007 acceptance criteria (scope change from original T-006).
3. Read `ListOptionsSheet.jsx`, `RenameListSheet.jsx`, `ShareListSheet.jsx` in full.
4. Inspected `git diff --staged` (new sheet files) and `git diff` (modified: `App.jsx`, `BottomNav.jsx`, `ListDetailPage.jsx`, `index.css`, `app.test.jsx`, `ui.test.jsx`).
5. Ran `npm run lint` → **0 errors**.
6. Ran `npm run build` → **clean** (254 kB JS).
7. Ran `npm test` → **19/19 frontend + 25/25 backend tests pass**.

##### Findings

**All acceptance criteria met:**

| Criterion | Result |
|---|---|
| Search tab removed from BottomNav | ✅ `tabs` array reduced to single Lists entry; `ui.test.jsx` confirms no Search button |
| `/search` route removed from App.jsx | ✅ Import + `<Route>` removed; `/search` now falls through to `<Navigate to="/" replace />` |
| TopBar shows moreVertical "List options" button (owner only) | ✅ `ariaLabel: "List options"`, `name="moreVertical"`; test confirms presence and absence of old "Share list" button |
| Tapping options opens `ListOptionsSheet` | ✅ `setShowOptions(true)`; test confirms `role="dialog" name="List Options"` |
| "Rename list" → `RenameListSheet` with name pre-filled | ✅ `currentName={list?.name}` prop; `useEffect` syncs on open; test reads pre-filled value |
| Saving calls `renameList` API | ✅ `handleRename` calls `renameList(token, id, { name })`; TopBar title updates to new name |
| "Share list" → `ShareListSheet` with email form + member list | ✅ `setShowShare(true)`; `ShareListSheet` has form, member list, Revoke; test verifies flow end-to-end |
| Existing sharing logic preserved | ✅ `handleShareSubmit`, `handleRevokeMember` unchanged; state props passed through |
| `/search` redirects to overview | ✅ Catch-all `<Navigate to="/">` handles it; test confirms `Lists` tab is active |
| `npm run lint` passes | ✅ 0 errors |
| `npm run build` passes | ✅ Clean |
| `npm test` passes | ✅ 19/19 frontend |

**Scope clean-up verified:**
- `SharingPanel` inline component fully removed from `ListDetailPage.jsx` ✓
- `isSharingOpen` state replaced by `showOptions`, `showRename`, `showShare` ✓
- `renameList` import added to `ListDetailPage.jsx`; `handleRename` wired with offline-aware update ✓
- `SearchPage` import removed from `App.jsx` ✓

##### Risks

- `/search` now redirects silently to `/` via the catch-all route. Any bookmarked search URLs will land on the overview without error. Acceptable.
- `handleRename` updates `list.name` in local state. The TopBar title re-renders immediately with the new name, consistent with the offline-first update pattern used elsewhere in the codebase.

#### Verdict
`PASS`

---

## Task: T-008 — E2E Tests: Shopping List CRUD

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-24

#### Findings

No blocking, major, or minor findings.

- **nit** — `lists.spec.js` adds `test.use({ hasTouch: true })` (line 10). The plan did not mention this, but it is essential: Playwright skips touch-event dispatch by default in Chromium without this flag. Without it the swipe test would pass vacuously (no events fired). Positive addition.
- **nit** — `swipeEntryLeft` includes `pageX`, `pageY`, `screenX`, `screenY` fields in the `Touch` constructor beyond the plan spec. These improve cross-browser Touch compatibility. Positive.
- **nit** — Sheet locators use `getByRole("dialog", { name: "..." })` rather than the plan's `getByText(...)`. Querying by ARIA dialog role and accessible name is strictly more robust. Positive.
- **nit** — `auth.spec.js` fix correctly targets both occurrences and uses `"No lists yet"` (without the ellipsis) to match the `EmptyState` title rendered by T-004. Correct.

#### Verification

##### Steps
1. Re-read `.ai/TASKS.md` — T-008 confirmed `ready_for_review`.
2. Re-read T-008 section of `.ai/PLAN.md`.
3. Read `e2e/lists.spec.js` and `e2e/auth.spec.js` in full.
4. Verified T-008 acceptance criteria point-by-point (see table below).
5. Ran `npm run lint` → **0 errors** (1 pre-existing Fast Refresh warning in `AuthContext.jsx`).
6. Ran `npm run build` → **clean** (975 kB precache, within Workbox limit).
7. Ran `npm test` → **19/19 frontend + 25/25 backend** tests pass.
8. Ran `npm run e2e` → **9/9 tests pass** (5 auth + 4 lists, 17 s).

##### Findings

**All acceptance criteria met:**

| Criterion | Result |
|---|---|
| `e2e/lists.spec.js` — creates a new shopping list | ✅ test at line 118; FAB → NewListSheet dialog → fill name → submit → card appears |
| `e2e/lists.spec.js` — adds an item to a shopping list | ✅ test at line 133; API-created list → navigate → FAB → AddItemSheet dialog → fill → submit → row appears |
| `e2e/lists.spec.js` — deletes an item via swipe | ✅ test at line 151; API-created entry → swipe 95 px left (> 80 px threshold) → row gone |
| `e2e/lists.spec.js` — marks an item as done | ✅ test at line 166; toggle button label flips; `.entry-row-text-done` class applied |
| `auth.spec.js` "registers" assertion fixed | ✅ line 44: `getByText("No lists yet")` |
| `auth.spec.js` "logs in" assertion fixed | ✅ line 93: `getByText("No lists yet")` |
| `npm run e2e` passes all 9 tests | ✅ 9 passed (17.0 s) |
| `npm run lint` passes | ✅ 0 errors |
| `npm run build` passes | ✅ Clean |
| `npm test` passes | ✅ 19/19 frontend, 25/25 backend |

**Implementation quality:**
- `setupLoggedInUser` injects the JWT via `localStorage` and reloads — fast, deterministic, avoids re-testing the auth UI flow.
- `createListByApi` / `createEntryByApi` set up test fixtures via API — eliminates UI flakiness in precondition steps.
- `swipeEntryLeft` dispatches three synthetic `TouchEvent`s (`touchstart` → `touchmove` → `touchend`) with correct `touches`/`changedTouches`/`targetTouches` arrays, matching `EntryRow`'s handler signature.

##### Risks

- Swipe test depends on the `.entry-row` CSS selector and the 80 px `clientX` delta threshold in `EntryRow`. If either changes, the test needs updating. Acceptable for current scope.
- E2E tests create real database rows with no teardown. Matches existing `auth.spec.js` pattern; appropriate for this integration environment.

#### Verdict
`PASS`
