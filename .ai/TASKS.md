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
| T-001 | Add GNU GPL v3 license | done | LICENSE exists at root with full GPL v3 text; package.json has `"license": "GPL-3.0-or-later"`; README.md has GPL-3.0 badge and `## License` section | `npm run test --workspace backend -- src/license.test.js`; `npm run lint`; `npm run build`; `npm test` | none |
| T-002 | InfoSheet: settings button & info bottom sheet | done | Settings icon button top-right in OverviewPage replaces logout button; clicking opens bottom sheet titled "Info & Settings" with logout action, version row, and GPL v3 license link; lint + build + tests pass | `npm run lint`; `npm run build`; `npm test` | none |
