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
| T-001 | Add Vite dev-server proxy so `/api` requests reach the backend | done | `POST /api/auth/register` returns 201 in dev; `npm run lint` and `npm run build` pass | `npm run lint` passed with one existing warning in `frontend/src/context/AuthContext.jsx`; `npm run build` passed; `npm test` passed | none |
| T-002 | Create root `README.md` with full local development setup guide | done | `README.md` exists at project root; covers env setup, Docker DB, migrations, and `npm run dev`; `npm run lint` and `npm run build` pass | `npm run lint` passed with one existing warning in `frontend/src/context/AuthContext.jsx`; `npm run build` passed | none |
| T-003 | Fix `npm run migrate` to load `.env` automatically via `--env-file` | done | `npm run migrate` succeeds with only a `.env` file present; no manual shell export needed; `npm run lint` and `npm run build` pass | `npm run migrate` passed with only `.env`; `npm run lint` passed with one existing warning in `frontend/src/context/AuthContext.jsx`; `npm run build` passed; `npm test` passed | none |
| T-004 | Fix backend dev server to load `DATABASE_URL` from root `.env` regardless of CWD | done | `POST /api/auth/register` returns 201 in dev; no "Database connection is not configured" error; `npm run lint`, `npm run build`, `npm test` pass | `backend/src/env.test.js` now verifies root `.env` loading is CWD-independent; `npm run lint` passed with one existing warning in `frontend/src/context/AuthContext.jsx`; `npm run build` passed; `npm test` passed (24 backend tests, including the new CWD-independence test) | none |
| T-005 | Add Playwright E2E tests for registration and login | done | `npm run e2e` runs 5 scenarios (register happy path, duplicate email, login happy path, wrong password, unknown email) against the full stack; all pass; `npm run lint` and `npm run build` pass | `npm run lint` passed with one existing warning in `frontend/src/context/AuthContext.jsx`; `npm run build` passed; `npm run e2e` passed all 5 Playwright auth scenarios against the full stack after `npx playwright install chromium`; live E2E re-run not feasible in review env (no Docker), verified via code review + implementer evidence | none |
