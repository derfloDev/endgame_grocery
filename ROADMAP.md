# ROADMAP

Goal: CSS-Refactoring — Migrate from a single monolithic `index.css` to per-component CSS Modules for all application-specific styles, while retaining design tokens and shared utilities in a centrally-imported stylesheet.

## Priority 1 — CSS Modules migration

Objective: every component owns its private styles via a co-located CSS Module; the global stylesheet is reduced to resets, animations, and design tokens only.

### Scope

All `.tsx` files under `frontend/src/`:
- `components/ui/` — TopBar, FAB, BottomSheet, EmptyState, ErrorState, LoadingState, Icon
- `components/` — AddItemSheet, AutocompleteSuggestions, EntryTile, InfoSheet, LanguageSwitcher, ListCardHome, ListOptionsSheet, NewListSheet, OfflineBanner, RecentlyUsedSection, RenameListSheet, ShareListSheet
- `pages/` — LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage, InviteAcceptPage, OverviewPage, ListDetailPage, SearchPage
- `App.tsx`

### Folder structure convention

`ComponentName/ComponentName.tsx` + `ComponentName/ComponentName.module.css` (original filename kept, not renamed to `index.tsx` — preserves readable stack traces).

### Shared design-system classes (`eg-*`, `button-row`, `stack`, …)

These classes (`eg-btn-primary`, `eg-icon-btn`, `eg-chip-*`, `eg-input`, `eg-field`, `eg-card`, `eg-gradient-text`, `eg-orbitron`, `button-row`, `stack`, `pill`, `visually-hidden`, …) are used across 8–15 components. Two options:

**Option A — Keep as global design-system stylesheet (recommended)**
- Extract to `styles/shared.css`; import remains global via `index.css`
- Components continue using bare class strings: `className="eg-btn-primary"`
- No duplication; consistent with treating `eg-*` as an internal utility-class library
- Global stylesheet is reduced to only truly global rules + this design-system layer

**Option B — Full module migration (shared CSS Module)**
- Move `eg-*` classes into `styles/DesignSystem.module.css`
- Every component that uses a shared class must import it: `import ds from '../../styles/DesignSystem.module.css'`
- Eliminates all global strings; adds boilerplate imports everywhere

### Cross-component compound selectors

`index.css` contains rules like `.bottom-sheet--browser-open .add-item-form { … }` (13 such selectors). Resolution: replace with direct conditional class application in `AddItemSheet.tsx` using existing `showIconBrowser` state — cleaner than `:global()` workarounds.

### Acceptance criteria

- Each component has a co-located `ComponentName.module.css`
- `index.css` retains only: `:root`, `*`, `html`, `body`, `button/input` resets, `h1/p`, `#root`, `@keyframes`
- All component-specific class strings are replaced by CSS Module references
- `npm run build` passes with no errors
- `npm run lint` passes with no warnings
- `npm test` passes

### Out of scope

- Design token changes
- Visual appearance changes
- Renaming existing CSS class concepts
