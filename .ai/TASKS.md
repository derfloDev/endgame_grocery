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
| T-001 | Fix OverviewPage topbar: settings button visible AND app name not clipped on mobile | done | App name fully visible (no clipping) on ≥ 320 px; settings button always visible; sort row below brand row on all sizes; lint + build + tests pass | `npm run lint` pass (1 existing warning); `npm run build` pass; `npm test` pass; `npm run e2e -- e2e/lists.spec.js` pass | none |
