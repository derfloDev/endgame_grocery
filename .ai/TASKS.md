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
| T-003 | Auth pages redesign | ready_for_implement | Login and Register pages show dark auth-card, logo + Orbitron "ENDGAME/GROCERY" brand header, neon input focus ring, gradient primary button; form submission and error display remain functional; `npm run lint` passes; `npm run build` passes | n/a | implement |
| T-004 | Overview page redesign | ready_for_implement | Overview shows dark neon list cards with owner/shared chips; FAB opens NewListSheet bottom sheet; creating a list adds it to the list; rename and delete still accessible via moreVertical menu; Active/All toggle renders; empty/loading/error states display; logout functional; `npm run lint` passes; `npm run build` passes; `npm test` passes | n/a | implement |
| T-005 | List detail page redesign | ready_for_implement | TopBar shows list name with back navigation; FAB opens AddItemSheet; adding an item creates an entry; items toggle done/open with neon styling and strikethrough; swipe-to-delete (>80 px left) deletes an entry; done section is collapsible; sharing panel (owner only) renders and functions; `npm run lint` passes; `npm run build` passes; `npm test` passes | n/a | implement |
| T-006 | Search page | ready_for_implement | Navigating to Search tab shows the search screen; typing filters lists by name (case-insensitive); clicking a result navigates to `/lists/:id`; empty-query and no-results states display correctly; `npm run lint` passes; `npm run build` passes | n/a | implement |
