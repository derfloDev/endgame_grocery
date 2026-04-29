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
| T-001 | Structured backend logging via pino + pino-http | done | (1) Every HTTP request/response logged with method, URL, status, duration. (2) Startup log shows port, DB/SMTP/VAPID configured flags, log level. (3) Auth events (register, login, verify, reset) logged at info/warn. (4) Push worker lifecycle and per-job events logged. (5) Mailer send success/skip/error logged. (6) No console.* calls remain in production code. (7) LOG_LEVEL env var documented in docker-compose.example.yml. (8) npm run lint + npm run build + npm test all pass. | `npm run lint`, `npm run build`, `npm test` | none |
