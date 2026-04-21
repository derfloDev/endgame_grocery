# endgame_grocery

Shared grocery list monorepo with a React frontend, an Express backend, and PostgreSQL for persistence.

## Workspace layout

- `frontend` contains the Vite + React application shell.
- `backend` contains the Express API scaffold and database wiring placeholders.
- Authentication now includes backend register/login endpoints plus protected frontend routes for `/`, `/lists/:id`, `/login`, and `/register`.
- List management now includes authenticated list CRUD endpoints and an overview UI for create, rename, delete, and shared-list indicators.
- `.ai` contains the planning, review, and handoff artifacts used by the role workflow.

## Getting started

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with `docker compose up -d`.
3. Install dependencies with `npm install`.
4. Apply the database schema with `npm run migrate`.
5. Seed demo data with `npm run db:seed`.
6. Run the apps with `npm run dev`.
7. Open the frontend and register a user, or log in with the seeded demo account after a successful seed run.

## Validation

- `npm run lint`
- `npm run build`
- `npm test`

## Database workflow

- `npm run migrate` applies the PostgreSQL schema from `backend/src/db/migrations`.
- `npm run db:seed` inserts one demo user, one demo list, and starter entries for local development.

## Authentication workflow

- `POST /api/auth/register` creates a user with `email`, `password`, and `display_name`.
- `POST /api/auth/login` returns a JWT access token.
- The frontend stores the token in `localStorage` and redirects unauthenticated access to `/login`.

## List workflow

- `GET /api/lists` returns all lists the current user owns or can access through sharing, with `is_owner` and `owner_name`.
- `POST /api/lists` creates a new owned list.
- `PATCH /api/lists/:id` renames a list for the owner only.
- `DELETE /api/lists/:id` deletes a list for the owner only.
- The overview screen supports create, rename, delete, and navigation into protected list routes.

## AI workflow

This project uses the persistent planner/implementer/reviewer workflow defined in `AGENTS.md`.
