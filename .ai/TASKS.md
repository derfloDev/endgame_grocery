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
| T-001 | Persist `details` in autocomplete history (backend: migration, historyUtils, entries route, history route, tests) | done | (1) Details survive page reload in recently-used; (2) details restored when re-added to open entries; (3) null-details entries unchanged; (4) all tests pass; (5) build passes | `node --test src/entries.test.js src/history.test.js src/db/migrations.test.js src/v1.test.js`; `npm run lint`; `npm run build`; `npm test` | none |
