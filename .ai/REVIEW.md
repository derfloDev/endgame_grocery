# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

---

## Task: T-001

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-05-12

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `frontend/src/styles/shared.css:43` | `.eg-btn` added to the button base selector group — not present in original `index.css` and not listed in the plan. Harmless alias, but it's out of scope for T-001. | No |
| 2 | nit | `frontend/src/styles/tokens.css` (new file) | `tokens.css` was created to hold CSS custom properties extracted from `index.css`. This file is not mentioned in the plan (T-001 scope is `shared.css` + `auth.module.css` only). The extraction is beneficial and forward-compatible with T-005, but it is an unplanned addition. `index.css` now imports it first and the `:root` block was stripped of variable declarations. | No |

No blockers or major findings.

#### Verification

##### Steps
- Read `frontend/src/styles/shared.css`, `auth.module.css`, `tokens.css`, and `frontend/src/index.css`.
- Cross-checked all planned classes from `.ai/PLAN.md` CSS class inventory against `shared.css` and `auth.module.css`.
- Verified `index.css` contains `@import "./styles/tokens.css"`, `@import "./styles/shared.css"`, and `@import "./styles/auth.module.css"` at the top.
- Confirmed no TSX files were modified (scope check via git diff — clean).
- Ran `npm run lint` → 0 errors, 1 pre-existing warning (`AuthContext.tsx` Fast Refresh).
- Ran `npm run build` → clean build, pre-existing chunk size warning only.
- Ran `npm test` → 106/106 pass, 0 fail.

##### Findings
- All `eg-*` and shared utility classes from the plan are present in `shared.css`. ✓
- All `auth-*` classes (`.auth-layout`, `.auth-card`, `.auth-brand`, `.auth-logo`, `.auth-brand-title`, `.auth-brand-sub`, `.auth-form`, `.compact-form`) plus descendant rules (`.auth-card h1`, `.auth-card > p`) and the responsive `@media (max-width: 640px) .auth-card` block are present in `auth.module.css`. ✓
- `index.css` correctly imports both new files and the additional `tokens.css`. ✓
- No component TSX changes. ✓
- `shared.test.ts` added with per-class existence assertions covering all planned shared and auth classes.

##### Risks
- `auth.module.css` is both globally imported in `index.css` (plain CSS) and will later be consumed as a CSS Module by TSX pages (T-004). Vite will inject the file twice in production builds — once as global CSS and once as a scoped module chunk. This is expected to be resolved during T-004 (removing the `@import` from `index.css` once all auth pages use the module). No action needed in T-001.
- `tokens.css` is now imported before `shared.css` in `index.css`. If any later task adds a `tokens.css` with conflicting variable names, the load order is already established.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`

---

## Task: T-002

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-05-12

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | minor | `frontend/src/components/AddItemSheet.tsx:62` | `AddItemSheet` still uses the legacy global class string `"bottom-sheet--browser-open"` via the `className` prop instead of the new `browserOpen={showIconBrowser}` boolean prop. This is T-003 scope (AddItemSheet migration is T-003), but it means the `browserOpen` prop is implemented yet not wired up. **Risk:** If T-005 runs before T-003 completes the AddItemSheet migration, the icon-browser layout will break because global class `.bottom-sheet--browser-open` will be removed from `index.css`. T-002 has no blocker here, but T-003 must migrate this before T-005 runs. | No (T-003 scope) |
| 2 | nit | `frontend/src/components/ui/ui.test.tsx:85` | `browserOpen` class test asserts `className.split(" ").length >= 3` as a proxy for confirming the modifier class was applied. Passes in JSDOM since CSS Module hashes aren't resolved, but the assertion doesn't verify the actual modifier class identity. Acceptable pragmatism. | No |

No blocker or major findings.

#### Verification

##### Steps
- Read all 7 component TSX files and all 6 CSS module files (Icon has no module).
- Verified all plan-specified module classes are present in each module file.
- Verified CSS Module keyframes are locally scoped with prefixed names (`bottom-sheet-slide-up`, `bottom-sheet-fade-in`, `loading-shimmer`).
- Verified `ui/index.ts` exports all 7 components from their sub-folder paths.
- Grep'd for any remaining flat import paths (`ui/BottomSheet`, `ui/TopBar`, etc.) — none found.
- Verified consuming feature components (`AddItemSheet`, `InfoSheet`, `ListOptionsSheet`, `NewListSheet`, `RenameListSheet`, `ShareListSheet`, page components) all import from the `./ui` or `../components/ui` barrel — paths unchanged and correct.
- Ran `npm run lint` → 0 errors, 1 pre-existing warning.
- Ran `npm run build` → clean, pre-existing chunk size warning only.
- Ran `npm test` → 106/106 pass, 0 fail.

##### Findings
- **T-002 scope fully met**: all 7 UI primitives moved into sub-folders with co-located CSS Modules (where applicable); `browserOpen` prop added to `BottomSheet`; `ui/index.ts` updated.
- **Plan class inventory verified**:
  - `TopBar`: `topbar`, `topbar-copy`, `topbar-title`, `topbar-subtitle` ✓
  - `FAB`: `fab` + `:hover` ✓
  - `BottomSheet`: `bottom-sheet-backdrop`, `bottom-sheet`, `bottom-sheet--browser-open`, `bottom-sheet form`, `bottom-sheet-handle`, `bottom-sheet-title` ✓
  - `EmptyState`: `empty-state`, `empty-state-title`, `empty-state-body`, `empty-state-action` ✓
  - `ErrorState`: `error-state`, `error-state-title`, `error-state-body`, `error-state-action` ✓
  - `LoadingState`: `loading-state`, `loading-state-row` + local `@keyframes loading-shimmer` ✓
  - `Icon`: no module (no private styles) ✓

##### Risks
- `AddItemSheet` passes `className="bottom-sheet--browser-open"` (global string) to `BottomSheet` — this relies on the global rule still existing in `index.css`. T-003 must switch this to `browserOpen={showIconBrowser}` before T-005 removes the global class.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`

---

## Task: T-003

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-05-12

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | minor | `frontend/src/components/RecentlyUsedSection/RecentlyUsedSection.tsx:26-28` | Uses `"entry-section"`, `"entry-section-header"`, and `"detail-section-label"` as global class strings. Per the plan these are listed as private `ListDetailPage.module.css` classes (T-004 scope). Since `RecentlyUsedSection` also applies these classes to its own root, they are cross-component shared utilities — NOT page-private. **T-004 must NOT move these to `ListDetailPage.module.css`.** They must stay global or be added to `shared.css`. This is a T-004 guard, not a T-003 defect. | No (T-004 guard) |
| 2 | minor | `frontend/src/components/ShareListSheet/ShareListSheet.tsx:66-67` | Uses `"detail-banner"` as a global class. `detail-banner` is also used in `ListDetailPage.tsx:574` and is planned as a `ListDetailPage` private module class (T-004). If T-004 privatizes it, `ShareListSheet` loses `margin-bottom: 12px` on its feedback area. T-004 must keep `detail-banner` in `shared.css` or as a global. | No (T-004 guard) |
| 3 | nit | `frontend/src/components/ShareListSheet/ShareListSheet.module.css:6-17` | `.sharing-panel` and `.sharing-panel-form` are defined in the module but not referenced in `ShareListSheet.tsx`. Dead CSS Module classes — no functional impact. | No |
| 4 | nit | `frontend/src/components/.gitkeep` | Orphaned `.gitkeep` placeholder file in the now-populated components root directory. Harmless. | No |

No blocker or major findings. The T-002 risk (AddItemSheet using global `bottom-sheet--browser-open` string) is **resolved** — `AddItemSheet.tsx:181` correctly passes `browserOpen={showIconBrowser}` to `BottomSheet`. ✓

#### Verification

##### Steps
- Read all 13 feature component TSX files and all 11 CSS module files (OfflineBanner and ProtectedRoute have no module per plan).
- Verified all plan-specified module classes are present in each module file.
- Verified compound selector resolution in `AddItemSheet`: all 5 compound selectors (form, disclosure, icon-browser, icon-browser-inner, icon-browser-grid) replaced by state-driven `--browser-open` modifier classes applied directly in TSX. ✓
- Verified `BottomSheet` receives `browserOpen={showIconBrowser}` — T-002 risk resolved. ✓
- Checked `animation: spin` in `ShareListSheet.module.css` — global `@keyframes spin` is retained in `index.css` after T-005 per plan; reference is valid. ✓
- Verified `add-item-form--browser-open > :not(.add-item-disclosure)` — CSS Modules scopes class names inside `:not()` correctly. ✓
- Confirmed no old flat-path imports remain for any moved component. All page/App.tsx imports use sub-folder paths. ✓
- Confirmed `eg-btn` class usage in `InfoSheet.tsx:42` is valid (added to `shared.css` in T-001). ✓
- Ran `npm run lint` → 0 errors, 1 pre-existing warning.
- Ran `npm run build` → clean, pre-existing chunk size warning only.
- Ran `npm test` → 106/106 pass, 0 fail.

##### Findings
- **T-003 scope fully met**: all 13 feature components in sub-folders; 11 have co-located CSS Modules; AddItemSheet compound selectors resolved; all consumer import paths updated.
- `entry-tile-grid` stays as a global (layout wrapper in `ListDetailPage`) — correctly absent from `EntryTile.module.css`. ✓

##### Risks
- **T-004 implementation guard**: `entry-section`, `entry-section-header`, `detail-section-label`, and `detail-banner` are shared between `ListDetailPage.tsx` and feature components (`RecentlyUsedSection`, `ShareListSheet`). The plan erroneously lists these as `ListDetailPage` private module classes. T-004 **must** move them to `shared.css` (or leave them global) rather than privatizing them, or feature component rendering will break when T-005 cleans `index.css`.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`

---

## Task: T-004

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-12

#### Findings

No findings. All scope items implemented correctly. T-003 guards honoured.

#### Verification

##### Steps
- Read `App.tsx`, `App.module.css`, all 9 page TSX files, all 3 non-auth page CSS modules, `page-components.test.ts`, `ListDetailPage.test.tsx`.
- Verified all 6 auth pages import `styles` from `"../../styles/auth.module.css"` and use `styles["auth-layout"]`, `styles["auth-card"]`, `styles["auth-form"]`. ✓
- Verified `App.tsx` imports `styles from "./App.module.css"` and uses `styles["app-shell"]`. ✓
- Verified `App.module.css` uses `:global(.stack)` for the `.stack` descendant selector. ✓
- Verified T-003 guards: `entry-section`, `entry-section-header`, `detail-section-label`, `detail-banner` are **NOT** in `ListDetailPage.module.css` — they were instead added to `shared.css` (lines 264–313 of `shared.css`). ✓
- Verified `ListDetailPage.module.css` contains only truly-private classes: `detail-content`, `detail-meta`, `detail-member-badges`, `entry-tile-grid`. ✓
- Verified `OverviewPage.module.css` contains all plan-specified classes: `overview-topbar`, `overview-brand`, `overview-brand-title`, `overview-brand-sub`, `overview-actions`, `overview-logo`, `overview-content`, `overview-header`. ✓
- Verified `SearchPage.module.css` contains `search-page`, `search-page-title`. ✓
- Verified `page-components.test.ts` includes a dedicated assertion (`keeps cross-component detail and entry section classes shared`) that guards against future regressions of the T-003 finding. ✓
- All page import paths in `App.tsx` updated to sub-folder form (`./pages/LoginPage/LoginPage` etc.). ✓
- Ran `npm run lint` → 0 errors, 1 pre-existing warning.
- Ran `npm run build` → clean, pre-existing chunk size warning only.
- Ran `npm test` → 106/106 pass, 0 fail.

##### Findings
- **T-004 scope fully met**: all 9 pages moved to sub-folders; 3 non-auth pages have co-located CSS Modules; 6 auth pages use shared `auth.module.css`; `App.tsx` uses `App.module.css`; all import paths updated.
- The `page-components.test.ts` cross-component guard test locks in the T-003 finding resolution — any regression would fail CI. Excellent defensive coverage.
- `SearchPage` is not yet wired into the router in `App.tsx` — this is pre-existing behaviour (it was not in the router before T-004 either). Not a T-004 regression.

##### Risks
- `auth.module.css` is still imported globally via `@import` in `index.css` AND as a CSS Module by auth pages. This causes the auth styles to be injected twice (once globally, once via the module). T-005 must remove the `@import "./styles/auth.module.css"` line from `index.css` to resolve this duplication.

#### Open Questions
- None.

#### Verdict
`PASS`
