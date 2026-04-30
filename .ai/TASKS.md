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
| T-001 | Disable registration via `REGISTRATION_ENABLED` runtime env var | done | `POST /api/auth/register` returns 404 when `REGISTRATION_ENABLED=false`; `GET /api/config` returns `{ registrationEnabled: false }`; frontend hides `/register` route and "Create an account" link | `npm run lint`; `npm run build`; `npm test` | none |
| T-002 | Log software version at Docker container start | done | `docker logs` shows version string in entrypoint output and in backend JSON startup log | `npm run lint`; `npm run build`; `npm test` | none |
| T-003 | Show logged-in user at top of Info & Settings sheet | ready_for_implement | `display_name` and `email` visible above the logout button immediately after login and after page reload | n/a | implement |
