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
| T-001 | Split `README.md` into Features (first), `docs/SETUP.md` and `docs/DEVELOPMENT.md` per `.ai/PLAN.md`; update "see README" code comments | done | README under ~120 lines with Features first and quick start; no README content lost (lossless line check reports 0 missing); links and images resolve; license test unchanged and passing; lint, build and tests pass | Lossless check: 0 missing lines; links 0 broken; lint, build, tests pass; review PASS_WITH_NOTES (4 nits, see .ai/REVIEW.md) | none |
