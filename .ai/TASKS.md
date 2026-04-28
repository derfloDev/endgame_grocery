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
| T-001 | Backend: move history trigger from POST /entries to PATCH (→ done) and DELETE; add GET + DELETE /history endpoints; update entries.test.js; new history.test.js | done | (1) POST /entries makes no autocomplete_history write. (2) PATCH→done upserts history. (3) DELETE entry upserts history. (4) GET /history returns ≤20 filtered + sorted items. (5) DELETE /history returns 204. All new and updated tests pass. | `npm run lint`; `npm run build`; `npm test` | none |
| T-002 | Frontend: new api/history.js; new RecentlyUsedSection component; ListDetailPage removes Done section, adds Recently Used section with one-tap add + dismiss; index.css styles | done | (6) Recently Used section visible below Open Items when history non-empty. (7) Tapping chip adds item and removes chip from panel. (8) Dismiss button removes chip and calls DELETE /history. (9) Done section absent. (10) Open items never appear in panel. | `npm run lint`; `npm run build`; `npm test` | none |
