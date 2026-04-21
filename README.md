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

## Entry workflow

- `GET /api/lists/:id/entries` returns all entries for any accessible list, ordered with open items first.
- `POST /api/lists/:id/entries` adds a new entry with `status = open`.
- `PATCH /api/lists/:id/entries/:entryId` updates entry text and/or status and refreshes `updated_at`.
- `DELETE /api/lists/:id/entries/:entryId` removes an entry from the list.
- The list detail screen groups open and done entries separately, supports Enter-to-add with immediate refocus, toggles status inline, and allows edit/delete actions.

## Sharing workflow

- `GET /api/lists/:id/members` returns the owner plus all shared members for an owned list.
- `POST /api/lists/:id/members` shares a list with another registered user by email and returns 404 for unknown users or 409 when access already exists.
- `DELETE /api/lists/:id/members/:userId` revokes a shared member while preventing the owner from removing themselves.
- The list detail screen exposes a sharing panel for owners, and the overview marks shared lists with a badge plus the owner name.

## AI workflow

This project uses the persistent planner/implementer/reviewer workflow defined in `AGENTS.md`.
