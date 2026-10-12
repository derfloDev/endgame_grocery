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
| T-001 | Restore nginx startup with server-scoped gzip settings, build-time validation and a production-image CI smoke check; update README and configuration/test comments | done | All four gzip directives live inside server; complete image configuration passes nginx -t; invalid configuration fails the image build; CI verifies HTTP, gzip/Vary, cache and security headers using the production image; regression checks fail on the old configuration; lint/build/tests pass | Implemented 2026-10-12T04:52:40Z; targeted tests fail before/pass after; lint/build/typecheck/full tests pass; original image nginx -t fails on duplicate gzip_vary; guarded fixed build and Linux smoke pass; isolated negative build fails at nginx -t; see HANDOFF; review PASS 2026-10-12T05:02:26Z, required checks/image/browser/manual verification passed; see REVIEW | none |
