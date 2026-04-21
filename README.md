# endgame_grocery

Shared grocery list monorepo with a React frontend, an Express backend, and PostgreSQL for persistence.

## Workspace layout

- `frontend` contains the Vite + React application shell.
- `backend` contains the Express API scaffold and database wiring placeholders.
- `.ai` contains the planning, review, and handoff artifacts used by the role workflow.

## Getting started

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with `docker compose up -d`.
3. Install dependencies with `npm install`.
4. Run the apps with `npm run dev`.

## Validation

- `npm run lint`
- `npm run build`
- `npm test`

## AI workflow

This project uses the persistent planner/implementer/reviewer workflow defined in `AGENTS.md`.
