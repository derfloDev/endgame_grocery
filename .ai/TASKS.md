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
| T-001 | Design tokens & app shell | done | App background is dark navy #080B1C; Google Fonts (Orbitron, Exo 2) load on all pages; logo asset at `frontend/src/assets/endgame_grocery_logo.png`; BottomNav renders on `/` and `/search` but not on `/login` or `/register`; `/search` route exists and does not crash; `npm run lint` passes; `npm run build` passes; `npm test` passes | `npm run lint`, `npm run build`, `npm test` pass | none |
| T-002 | Shared UI component library | done | All 8 components (Icon, TopBar, FAB, BottomNav, EmptyState, LoadingState, ErrorState, BottomSheet) render without errors; BottomNav active state responds to current route; BottomSheet opens and closes with slideUp animation; barrel export in `ui/index.js` works; `npm run lint` passes; `npm run build` passes | `npm run test --workspace frontend -- src/components/ui/ui.test.jsx`, `npm run lint`, `npm run build`, `npm test` pass | none |
| T-003 | Auth pages redesign | done | Login and Register pages show dark auth-card, logo + Orbitron "ENDGAME/GROCERY" brand header, neon input focus ring, gradient primary button; form submission and error display remain functional; `npm run lint` passes; `npm run build` passes | `npm run test --workspace frontend -- src/app.test.jsx`, `npm run lint`, `npm run build`, `npm test` pass | none |
| T-004 | Overview page redesign | done | Overview shows dark neon list cards with owner/shared chips; FAB opens NewListSheet bottom sheet; creating a list adds it to the list; rename and delete still accessible via moreVertical menu; Active/All toggle renders; empty/loading/error states display; logout functional; `npm run lint` passes; `npm run build` passes; `npm test` passes | `npm run test --workspace frontend -- src/app.test.jsx`, `npm run lint`, `npm run build`, `npm test` pass | none |
| T-005 | List detail page redesign | done | TopBar shows list name with back navigation; FAB opens AddItemSheet; adding an item creates an entry; items toggle done/open with neon styling and strikethrough; swipe-to-delete (>80 px left) deletes an entry; done section is collapsible; sharing panel (owner only) renders and functions; `npm run lint` passes; `npm run build` passes; `npm test` passes | `npm run test --workspace frontend -- src/app.test.jsx`, `npm run test --workspace frontend -- src/components/entry-row.test.jsx`, `npm run lint`, `npm run build`, `npm test` pass | none |
| T-006 | Search page | done | Dropped — search feature removed from scope per user decision 2026-04-24; Search tab removed from BottomNav and `/search` route cleaned up as part of T-007 | dropped | none |
| T-007 | List detail options flyout + BottomNav cleanup | done | Search tab removed from BottomNav; `/search` route removed from App.jsx; TopBar on list detail shows moreVertical options button (owner only) instead of share icon; tapping opens ListOptionsSheet with "Rename list" and "Share list" options; selecting Rename opens RenameListSheet with current name pre-filled, saving calls renameList API; selecting Share opens ShareListSheet with email form + member list (existing sharing functionality); existing sharing logic fully preserved; `npm run lint` passes; `npm run build` passes; `npm test` passes | `npm run test --workspace frontend -- src/components/ui/ui.test.jsx`, `npm run test --workspace frontend -- src/app.test.jsx`, `npm run lint`, `npm run build`, `npm test` pass | none |
| T-008 | E2E tests: shopping list CRUD | done | `e2e/lists.spec.js` contains 4 passing tests: create list, add item, delete item via swipe, mark item done; broken `getByText("No lists yet…")` assertions in `auth.spec.js` are fixed; `npm run e2e` passes all 9 tests (5 auth + 4 lists) | `npm run lint`, `npm run e2e`, `npm run build`, `npm test` pass | none |
| T-009 | Spacing-scale tokens & consistency fixes | done | `--space-1` through `--space-12` defined in `tokens.css`; 11 spacing properties in `index.css` updated to use tokens or correct values; `npm run lint` passes; `npm run build` passes; `npm test` passes | `npm run lint`, `npm run build`, `npm test` pass | none |
