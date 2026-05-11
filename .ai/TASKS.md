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
| T-001 | Icon suggestion: compound-word substring matching | done | `useIconSuggestion("Spritzpaprika")` → `CustomBellPepper` synchronously; `useIconSuggestion("Minimöhren")` → `IconCarrot` synchronously; no worker call in both cases; existing tests pass; 2 new test cases added | `npm run test --workspace frontend -- useIconSuggestion.test.js`; `npm run lint`; `npm run build`; `npm test` | none |
| T-002 | Replace cucumber SVG with cleaner design | done | `cucumber.svg` renders a recognisable cucumber (diagonal body, stem nub, texture lines); stroke-only, no hardcoded colours; viewBox 0 0 24 24; visual weight consistent with bellPepper and tomato icons | `npm run lint`; `npm run build`; `npm test` | none |
| T-003 | Flatten entry sections — remove card framing | done | `.entry-section` has no border, no border-radius, no background, no side padding; `.list-card` and `.sharing-panel` unchanged; sections retain vertical separation | `npm run lint`; `npm run build`; `npm run test --workspace frontend -- app.test.jsx`; `npm test` | none |
| T-004 | Optimistic UI: instant toggle and reactivate | done | Toggling done removes entry from open list in same render cycle; reactivating from history adds temp entry immediately; non-network errors revert state and show error; 3 new render-based tests added | `npm run test --workspace frontend -- ListDetailPage.test.jsx`; `npm run lint`; `npm run build`; `npm test` | none |
| T-005 | Tile grid: 3-col open entries + 2-col recently-used | done | Open entries render in 3-col grid (EntryTile); tap toggles done; 500 ms hold triggers edit with pressing visual feedback; no swipe-delete or edit button; recently-used renders in 2-col grid with overlay dismiss X; `handleDeleteEntry` removed from ListDetailPage; all relevant tests updated | `npm run test --workspace frontend -- useLongPress.test.jsx entry-tile.test.jsx RecentlyUsedSection.test.jsx ListDetailPage.test.jsx app.test.jsx`; `npm run lint`; `npm run build`; `npm test` | none |
| T-006 | Mobile fix: icon browser visible behind keyboard | done | Bottom sheet uses `dvh` so it shrinks when keyboard appears; icon grid is scrollable on 375×667 px viewport with ~300 px keyboard; no desktop regression; CSS-only change | `npm run test --workspace frontend -- AddItemSheet.test.jsx ListDetailPage.test.jsx`; `npm run lint`; `npm run build`; `npm test` | none |
| T-007 | "Mehr anzeigen" button → link style | done | Toggle button has no border or background; height ≤ 1.8 rem; hover/focus shows underline; button element and keyboard accessibility unchanged | `npm run test --workspace frontend -- AddItemSheet.test.jsx`; `npm run test --workspace frontend -- ListDetailPage.test.jsx`; `npm run lint`; `npm run build`; `npm test` | none |
