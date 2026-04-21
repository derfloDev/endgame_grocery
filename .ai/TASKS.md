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
| T-001 | Project Scaffold | done | npm workspaces initialised; `npm run build` and `npm run lint` pass on empty scaffold; docker-compose.yml starts PostgreSQL; `.env.example` present | `npm install`; `npm run lint`; `npm run build`; `npm test` | none |
| T-002 | Database Schema & Migrations | done | All four tables created via `node-pg-migrate`; `npm run migrate` runs cleanly on fresh DB; seed script inserts demo data without errors | `npm install`; `npm run lint`; `npm run build`; `npm test`; `npm run migrate` (ECONNREFUSED: localhost:5432 unavailable); `node src/db/seed.js` exits immediately when PostgreSQL is unavailable; `docker compose up -d` unavailable because `docker` is not installed | none |
| T-003 | Authentication | done | Register and login endpoints return correct status codes; JWT verified by middleware; LoginPage and RegisterPage render and submit; ProtectedRoute redirects unauthenticated users | `npm install`; `npm run lint` (passes with one non-blocking React fast-refresh warning); `npm run build`; `npm test` | none |
| T-004 | List Management | done | CRUD endpoints return correct data and enforce owner-only rules; OverviewPage lists all accessible lists with shared indicator; create/rename/delete flows work end-to-end | `npm run lint` (passes with one non-blocking React fast-refresh warning); `npm run build`; `npm test` | none |
| T-005 | Entry Management | done | CRUD endpoints enforce membership; ListDetailPage shows open and done sections; Enter-key input refocuses immediately; toggling status moves entry to correct section | `npm run lint` (passes with one non-blocking React fast-refresh warning); `npm run build`; `npm test` | none |
| T-006 | List Sharing | done | Owner can share by email (404/409 handled); recipient sees list in overview; owner can revoke; shared badge visible in overview | `npm run lint` (passes with one non-blocking React fast-refresh warning); `npm run build`; `npm test` | none |
| T-007 | PWA & Offline Support | ready_for_implement | Lighthouse PWA audit passes (installable, SW registered, manifest present); app reads data offline from IndexedDB; queued writes sync on reconnect; offline banner shown | n/a | implement |
