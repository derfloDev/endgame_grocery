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
| T-001 | Backend: DB migration + `icon` field in entry routes | done | Migration applies/rolls back; POST/PATCH accept `icon`; GET returns `icon` on every row; existing tests pass | `npm run lint` (pass, 1 existing frontend warning); `npm run test --workspace backend -- src/entries.test.js` (pass); `npm run test --workspace backend -- src/db/migrations.test.js` (pass); `npm run migrate` up/down/up (pass); `npm run build` (pass); `npm test` (pass) | none |
| T-002 | Frontend: bilingual icon database + cosine-similarity utility | done | `EXACT_MATCH_MAP` resolves known EN/DE terms; cosine-similarity test suite passes; ≥ 60 entries | `npm run lint` (pass, 1 existing frontend warning); `npm run test --workspace frontend -- src/utils/cosineSimilarity.test.js` (pass); `npm run build` (pass); `npm test` (pass) | none |
| T-003 | Frontend: transformers.js worker + `useIconSuggestion` hook + eager init | done | Worker initialises off main thread; exact-match resolves synchronously; below-threshold → null; hook unit tests pass | `npm install @xenova/transformers --workspace @endgame-grocery/frontend` (pass); `npm run test --workspace frontend -- src/hooks/useIconSuggestion.test.js` (pass); `npm run lint` (pass, 1 existing frontend warning); `npm run build` (pass, 1 upstream onnxruntime warning); `npm test` (pass) | none |
| T-004 | Frontend UI: `AddItemSheet` live preview + API/page wiring | done | Typing "Milch" shows 🥛 within 300 ms; icon passed through `onAdd` → `createEntry`; no lint errors | `npm run lint` (pass, 1 existing frontend warning in `frontend/src/context/AuthContext.jsx`); `npm run test --workspace frontend -- src/components/AddItemSheet.test.jsx src/app.test.jsx` (pass); `npm run build` (pass, 1 upstream `onnxruntime-web` eval warning); `npm test` (pass) | none |
| T-005 | Frontend UI: `EntryRow` icon display | done | EntryRow renders `entry.icon` or fallback 🛒; new test cases pass; swipe-delete test still passes | `npm run lint` (pass, 1 existing frontend warning in `frontend/src/context/AuthContext.jsx`); `npm run test --workspace frontend -- src/components/entry-row.test.jsx src/app.test.jsx` (pass); `npm run build` (pass, 1 upstream `onnxruntime-web` eval warning); `npm test` (pass) | none |
| T-007 | Frontend: install Tabler Icons + refactor icon database to Tabler icon names (≥80 icons: food + Haushalt + Drogerie) | done | `ICON_REGISTRY` ≥ 80 entries covering food, household, drugstore; `ICON_REGISTRY_KEYS` exported; `ICON_DB` has bilingual entries for household + drugstore; `EXACT_MATCH_MAP["toilettenpapier"]` → `"IconToiletPaper"`; build passes with tree-shaking; lint + tests pass | `npm install @tabler/icons-react --workspace @endgame-grocery/frontend` (pass); `npm run lint` (pass, 1 existing frontend warning in `frontend/src/context/AuthContext.jsx`); `npm run test --workspace frontend -- src/utils/cosineSimilarity.test.js` (pass); `npm run build` (pass, 1 upstream `onnxruntime-web` eval warning); `npm test` (pass) | none |
| T-008 | Frontend: update worker + hook to return icon name and top matches | done | Hook returns `{ iconName, topMatches, loading }`; exact match → `topMatches: []`; async path returns ≤5 topMatches strings; unit tests pass | `npm run lint` (pass, 1 existing frontend warning in `frontend/src/context/AuthContext.jsx`); `npm run test --workspace frontend -- src/hooks/useIconSuggestion.test.js src/components/AddItemSheet.test.jsx src/app.test.jsx` (pass); `npm run build` (pass, 1 upstream `onnxruntime-web` eval warning); `npm test` (pass) | none |
| T-011 | Frontend: `IconPickerSheet` shared full-catalogue picker component | done | All registry icons render in grid; search filters list; tapping fires `onSelect`; selected icon highlighted; tests pass | `npm run lint` (pass, 1 existing frontend warning in `frontend/src/context/AuthContext.jsx`); `npm run test --workspace frontend -- src/components/IconPickerSheet.test.jsx src/components/ui/ui.test.jsx` (pass); `npm run build` (pass, 1 upstream `onnxruntime-web` eval warning); `npm test` (pass) | none |
| T-009 | Frontend UI: `AddItemSheet` inline picker + "Mehr anzeigen" → `IconPickerSheet` | done | SVG preview renders; alternatives row visible for semantic matches; "Mehr anzeigen" opens `IconPickerSheet`; full picker selection updates preview; `onAdd` passes selected icon name; tests pass | `npm run lint` (pass, 1 existing frontend warning in `frontend/src/context/AuthContext.jsx`); `npm run test --workspace frontend -- src/components/AddItemSheet.test.jsx src/app.test.jsx` (pass); `npm run build` (pass, 1 upstream `onnxruntime-web` eval warning); `npm test` (pass) | none |
| T-010 | Frontend UI: `EntryRow` SVG icon + edit-mode inline picker + `IconPickerSheet` | ready_for_implement | View mode renders SVG (fallback for null); edit mode shows icon picker row + "Mehr anzeigen"; saving passes updated icon name; `onEdit` + `submitEditEntry` accept icon param; all tests pass | n/a | implement |
| T-006 | Configuration + documentation | ready_for_implement | `.env.example` + Dockerfile + docker-compose.example.yml updated; README env table + icon assignment section describes Tabler icon approach; `npm run build` succeeds | n/a | implement |
