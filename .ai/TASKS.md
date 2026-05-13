# TASKS

Use this board to coordinate handoff between planner, implementer, and reviewer.

Status values:
- `in_planning`
- `ready_for_implement`
- `in_implementation`
- `ready_for_review`
- `in_review`
- `ready_to_commit`
- `changes_requested`
- `done`

Command expectations:
- planner moves tasks into `in_planning` and `ready_for_implement`
- implementer moves tasks into `in_implementation`, `ready_for_review`, and `done`, and resumes work from `changes_requested` and `ready_to_commit`
- reviewer moves tasks into `in_review`, `ready_to_commit`, or `changes_requested`
- `status_cycle` should report deterministic task status, current owner role, and next recommended action based on this board

| Task ID | Scope | Status | Acceptance Criteria | Evidence | Next Role |
| --- | --- | --- | --- | --- | --- |
| T-001 | Create `styles/shared.css` (design-system globals) and `styles/auth.module.css` (auth page layout); add `@import` to `index.css`; no component TSX changes | done | `styles/shared.css` exists and contains all `eg-*` + shared utility classes; `styles/auth.module.css` exists with all `auth-*` classes; `index.css` imports both files; `npm run build` passes | `npm run lint`; `npm run build`; `npm test` | none |
| T-002 | Move UI primitives to sub-folders + CSS Modules: TopBar, FAB, BottomSheet (add `browserOpen` prop), EmptyState, ErrorState, LoadingState, Icon; update `ui/index.ts` | done | Each component has `ComponentName/ComponentName.tsx` + `ComponentName/ComponentName.module.css` (where applicable); `ui/index.ts` paths updated; all module class strings replace global strings in each component; `npm run build` + `npm test` pass | `npm run lint`; `npm run build`; `npm test` | none |
| T-003 | Move feature components to sub-folders + CSS Modules: AddItemSheet (resolve compound selectors via `browserOpen` prop + direct conditional classes), AutocompleteSuggestions, EntryTile, InfoSheet, LanguageSwitcher, ListCardHome, ListOptionsSheet, NewListSheet (create `new-list-form` style), OfflineBanner, ProtectedRoute, RecentlyUsedSection, RenameListSheet, ShareListSheet | done | Each component has `ComponentName/ComponentName.tsx` + module (where applicable); compound selectors in AddItemSheet replaced by state-driven classes; all import paths in consuming files updated; `npm run build` + `npm test` pass | `npm run lint`; `npm run test --workspace frontend -- components/feature-components.test.ts components/AddItemSheet/AddItemSheet.test.tsx components/AutocompleteSuggestions/AutocompleteSuggestions.test.tsx components/EntryTile/EntryTile.test.tsx components/InfoSheet/InfoSheet.test.tsx components/LanguageSwitcher/LanguageSwitcher.test.tsx components/RecentlyUsedSection/RecentlyUsedSection.test.tsx components/ShareListSheet/ShareListSheet.test.tsx`; `npm run build`; `npm test` | none |
| T-004 | Move pages to sub-folders + CSS Modules: LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage, InviteAcceptPage (all import `styles/auth.module.css`), OverviewPage, ListDetailPage, SearchPage; update App.tsx with `app-shell` module | ready_for_implement | Each page has `PageName/PageName.tsx` + `PageName/PageName.module.css` (where applicable); auth pages import shared `auth.module.css`; `detail-page` / `overview-page` wrapper classNames cleaned up or replaced with module locals; all import paths in `App.tsx` and router updated; `npm run build` + `npm test` pass | n/a | implement |
| T-005 | Remove all extracted component-specific styles from `index.css`; retain only resets, base typography, `#root`, and `@keyframes` | ready_for_implement | `index.css` contains ≤ 40 lines (only resets + animations); `styles/shared.css` is the new home for design-system classes; no visual regressions; `npm run lint` + `npm run build` + `npm test` all pass | n/a | implement |
