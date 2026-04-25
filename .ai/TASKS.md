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
| T-002 | Frontend: bilingual icon database + cosine-similarity utility | ready_for_implement | `EXACT_MATCH_MAP` resolves known EN/DE terms; cosine-similarity test suite passes; ≥ 60 entries | n/a | implement |
| T-003 | Frontend: transformers.js worker + `useIconSuggestion` hook + eager init | ready_for_implement | Worker initialises off main thread; exact-match resolves synchronously; below-threshold → null; hook unit tests pass | n/a | implement |
| T-004 | Frontend UI: `AddItemSheet` live preview + API/page wiring | ready_for_implement | Typing "Milch" shows 🥛 within 300 ms; icon passed through `onAdd` → `createEntry`; no lint errors | n/a | implement |
| T-005 | Frontend UI: `EntryRow` icon display | ready_for_implement | EntryRow renders `entry.icon` or fallback 🛒; new test cases pass; swipe-delete test still passes | n/a | implement |
| T-006 | Configuration + documentation | ready_for_implement | `.env.example` + Dockerfile + docker-compose.example.yml updated; README env table extended; `npm run build` succeeds | n/a | implement |
