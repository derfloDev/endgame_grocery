# Plan

Status: **ready**

Goal: CSS-Refactoring — migrate `frontend/src/index.css` from one monolithic file to per-component CSS Modules, while retaining a shared design-system stylesheet for cross-component utility classes.

## Scope

All `.tsx` files under `frontend/src/` and the global stylesheet `frontend/src/index.css`.

## Acceptance Criteria

- Every component with private styles has a co-located `ComponentName.module.css`.
- `index.css` retains only: `:root`, `*`, `html`, `body`, `button/input` resets, `h1/p` base, `#root`, and `@keyframes` declarations.
- All component-specific global class strings are replaced by CSS Module references (`styles.foo`).
- `eg-*` and other shared utility classes remain as global strings but live in `styles/shared.css`.
- `npm run build` passes with zero errors.
- `npm run lint` passes with zero warnings.
- `npm test` passes.

## Architecture Decision

**Option A confirmed:** `eg-*` and shared utility classes stay as global class strings, sourced from `styles/shared.css` (globally imported via `index.css`). Only component-private classes become CSS Module locals.

## Folder Convention

`ComponentName/ComponentName.tsx` + `ComponentName/ComponentName.module.css`  
Original filename is preserved (not renamed to `index.tsx`) for readable stack traces.

Import paths update automatically — see task-level details below.

---

## CSS class inventory

### Stays in `index.css` (resets + animations only after T-005)

`:root` (color-scheme + font), `*`, `html`, `body`, `button, input`, `button` (letter-spacing), `h1`, `p`, `#root`, `@keyframes shimmer/slideUp/fadeIn/spin`, `@media (max-width: 640px) h1`.

### Moves to `styles/shared.css` (design system — used across 2+ components)

| Class(es) | Consumed by |
|-----------|-------------|
| `.eg-btn-primary`, `.eg-btn-secondary`, `.eg-btn-ghost`, `.eg-btn-danger`, `.destructive-button`, `.button-primary`, `.button-secondary` | All pages + sheets |
| `.eg-icon-btn` | TopBar, ListCardHome, OverviewPage |
| `.eg-field`, `.field`, `.eg-input`, `.eg-input-wrap`, `.eg-input-anchor`, `.field input`, `.stack input` (focus + base) | AddItemSheet, LoginPage, RenameListSheet, ShareListSheet, … |
| `.button-row` | Auth pages, AddItemSheet, ListCardHome |
| `.eg-card`, `.eg-card-overlay` | ListCardHome |
| `.eg-chip-purple`, `.eg-chip-cyan`, `.eg-chip-success`, `.eg-chip-queued`, `.eg-chip-member-initial`, `.pill`, `.shared-pill` | EntryTile, ListCardHome, ListDetailPage |
| `.eg-orbitron`, `.eg-mono`, `.eg-gradient-text` | TopBar, OverviewPage, auth pages |
| `.eg-link`, `.muted-link`, `.muted-text` | Auth pages |
| `.eg-error-banner`, `.error-banner`, `.eg-offline-banner`, `.eg-success-banner` | OfflineBanner, LoginPage, ShareListSheet |
| `.stack`, `.tight-stack`, `.list-grid` | Multiple pages |
| `.list-card`, `.list-card-chips` | ListCardHome + ListDetailPage share `.list-card-chips` |
| `.entry-card`, `.entry-card-done`, `.entry-toggle`, `.entry-copy`, `.entry-text`, `.entry-text-done` | May be legacy; keep in shared to avoid breakage |
| `.member-card`, `.member-name` | ShareListSheet / ListDetailPage |
| `.card-title`, `.detail-title`, `.link-button` | Legacy utilities |
| `.visually-hidden` | AddItemSheet, ListCardHome |
| `.icon-picker-sheet`, `.icon-picker-search`, `.icon-picker-grid`, `.icon-picker-btn` | Dead code — keep in shared for safety |
| `@media (max-width: 640px)` > `.member-card`, `.auth-card` responsive rules | Shared + auth module |

### Moves to `styles/auth.module.css` (shared by all 6 auth pages)

`.auth-layout`, `.auth-card`, `.auth-card h1`, `.auth-card > p`, `.auth-brand`, `.auth-logo`, `.auth-brand-title`, `.auth-brand-sub`, `.auth-form`, `.compact-form`  
`@media (max-width: 640px)` > `.auth-card`

### Component CSS Modules (private styles only)

| Component | Module classes |
|-----------|----------------|
| `ui/TopBar` | `topbar`, `topbar-copy`, `topbar-title`, `topbar-subtitle` |
| `ui/FAB` | `fab` (incl. `:hover`) |
| `ui/BottomSheet` | `bottom-sheet-backdrop`, `bottom-sheet`, `bottom-sheet--browser-open`, `bottom-sheet form`, `bottom-sheet-handle`, `bottom-sheet-title` |
| `ui/EmptyState` | `empty-state`, `empty-state-title`, `empty-state-body`, `empty-state-action` |
| `ui/ErrorState` | `error-state`, `error-state-title`, `error-state-body`, `error-state-action` |
| `ui/LoadingState` | `loading-state`, `loading-state-row` (references `@keyframes shimmer` via `:global` or re-declares animation name) |
| `components/AddItemSheet` | `add-item-form`, `add-item-disclosure`, `add-item-disclosure--open`, `add-item-preview`, `add-item-preview-loading`, `add-item-preview-svg`, `add-item-preview-spinner`, `add-item-icon-picker`, `add-item-icon-picker-btn`, `add-item-icon-picker-btn--selected`, `add-item-more-btn`, `add-item-actions`, `add-item-icon-browser`, `add-item-icon-browser-inner`, `add-item-icon-browser--open`, `add-item-icon-browser-grid`, `add-item-icon-browser-btn`, `add-item-icon-browser-btn--selected`, `icon-picker-btn-label`; **compound selectors resolved** (see note below) |
| `components/AutocompleteSuggestions` | `autocomplete-suggestions`, `autocomplete-chip` |
| `components/EntryTile` | `entry-tile` (incl. modifiers + `:hover/:focus-visible`), `entry-tile-icon`, `entry-tile-text`, `entry-tile-details`, `entry-tile-chip` |
| `components/InfoSheet` | `info-sheet-section`, `info-sheet-logout`, `info-sheet-meta`, `info-sheet-user-name`, `info-sheet-user-email`, `info-sheet-language`, `info-sheet-label`, `info-sheet-value`, `info-sheet-link`, `info-sheet-donate` |
| `components/LanguageSwitcher` | `language-switcher`, `language-switcher-button`, `language-switcher-button-active` |
| `components/ListCardHome` | `list-card-home` (incl. `:hover`), `list-card-row`, `list-card-info`, `list-card-name`, `list-card-menu`, `list-card-menu-btn`, `list-card-menu-actions` |
| `components/ListOptionsSheet` | `list-options-sheet`, `list-option-row` (incl. `:hover` + sibling), `list-option-icon`, `list-option-icon-edit`, `list-option-icon-share`, `list-option-text`, `list-option-label`, `list-option-desc` |
| `components/NewListSheet` | `new-list-form` — **not in index.css**, create new: `display: grid; gap: 16px;` |
| `components/RecentlyUsedSection` | `recently-used-section`, `recently-used-grid`, `recently-used-cell`, `recently-used-chip` (incl. `:hover/:focus-visible`), `recently-used-chip-icon`, `recently-used-chip-text`, `recently-used-chip-dismiss` (incl. `:hover/:focus-visible`) |
| `components/RenameListSheet` | `rename-list-form` |
| `components/ShareListSheet` | `share-list-form`, `sharing-panel`, `sharing-panel-form`, `member-row` (incl. `:first-of-type`), `member-row-copy`, `member-row-name`, `member-row-email`, `member-row-actions`, `member-row-revoke`, `share-list-sheet-feedback`, `share-invite-spinner`, `share-list-label`, `share-sheet-members-label` |
| `pages/OverviewPage` | `overview-topbar`, `overview-brand`, `overview-brand-title`, `overview-brand-sub`, `overview-actions`, `overview-logo`, `overview-content`, `overview-header` |
| `pages/ListDetailPage` | `detail-content`, `detail-meta`, `detail-member-badges`, `detail-banner`, `detail-section-label` (incl. modifiers), `entry-section`, `entry-section-header`, `entry-section-collapse`, `entry-tile-grid`; sibling combinator `.entry-section + .entry-section` and `.entry-section-collapse .eg-chip-success` (using `:global`) |
| `pages/SearchPage` | `search-page`, `search-page-title` |
| `App.tsx` | `app-shell`, `app-shell > .stack` (using `:global(.stack)`), `app-shell > [aria-label="Search page"]` |

**Components with no private styles** (folder moved, no CSS module needed):  
`ui/Icon`, `components/OfflineBanner`, `components/ProtectedRoute`

---

## Compound selector resolution (AddItemSheet)

`index.css` contains 6 selectors of the form `.bottom-sheet--browser-open .add-item-*`.  
These apply layout overrides to AddItemSheet's children when the icon browser is open.

**Resolution:** since `AddItemSheet` already tracks `showIconBrowser` in state, replace each compound selector with a direct modifier class applied by the component itself:

```tsx
// Before
className={`add-item-form`}
// After
className={[styles.addItemForm, showIconBrowser && styles.addItemFormBrowserOpen].filter(Boolean).join(' ')}
```

Add `addItemFormBrowserOpen`, `addItemDisclosureBrowserOpen`, `addItemIconBrowserBrowserOpen`, `addItemIconBrowserInnerBrowserOpen`, `addItemIconBrowserGridBrowserOpen` classes to the module. The `BottomSheet`'s `className` prop no longer needs `bottom-sheet--browser-open`; that class can be removed from BottomSheet or kept as-is (it's a no-op once AddItemSheet stops relying on it).

The `bottom-sheet--browser-open` class itself lives in `BottomSheet.module.css` for the `flex + overflow: hidden` layout override on the sheet container.  
In `AddItemSheet.tsx`, set `sheetClassName = showIconBrowser ? styles.browserOpen : ""` and import the sheet's module — **but** since `BottomSheet` is a separate component, the cleanest approach is to add a `browserOpen?: boolean` prop to `BottomSheet` and let it apply the modifier class internally. This avoids leaking module hashes across component boundaries.

---

## Implementation Phases

### Phase 1 — T-001: Shared stylesheet foundation
Create `styles/shared.css` and `styles/auth.module.css`. Update `index.css` imports. No component TSX changes.

### Phase 2 — T-002: UI primitive CSS Modules
TopBar, FAB, BottomSheet (+ `browserOpen` prop), EmptyState, ErrorState, LoadingState, Icon. Update `ui/index.ts`.

### Phase 3 — T-003: Feature component CSS Modules
AddItemSheet, AutocompleteSuggestions, EntryTile, InfoSheet, LanguageSwitcher, ListCardHome, ListOptionsSheet, NewListSheet, OfflineBanner, ProtectedRoute, RecentlyUsedSection, RenameListSheet, ShareListSheet.

### Phase 4 — T-004: Page CSS Modules
LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage, InviteAcceptPage (all import `styles/auth.module.css`), OverviewPage, ListDetailPage, SearchPage, App.tsx.

### Phase 5 — T-005: Global stylesheet cleanup
Remove all extracted classes from `index.css`; leave only resets and `@keyframes`. Run full validation.

---

## Validation

```bash
npm run lint
npm run build
npm test
```
