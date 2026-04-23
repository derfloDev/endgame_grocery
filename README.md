<p align="center">
  <img src="endgame_grocery_logo.png" alt="Endgame Grocery" width="180" />
</p>

<p align="center">
  <img src="https://github.com/DerFloDev/endgame_grocery/actions/workflows/ci.yml/badge.svg" alt="CI" />
</p>

# endgame_grocery

Shared grocery list monorepo with a React frontend, an Express backend, and PostgreSQL persistence.

## Prerequisites

- Node.js 22.x
- npm 10.x or newer
- Docker Desktop or Docker Engine with Docker Compose support

## Local Development Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the environment file

Copy the example environment file and adjust values for your machine:

```bash
cp .env.example .env
```

The backend requires a valid `DATABASE_URL` before registration, login, or list APIs can work. `JWT_SECRET` is fine for local development, but you must replace it with a strong secret outside local use.

Backend commands that read configuration, including `npm run dev` and `npm run db:seed`, load this project-root `.env` file automatically even when npm starts them from the `backend/` workspace directory.

### 3. Start PostgreSQL

```bash
docker compose up -d
```

### 4. Run database migrations

```bash
npm run migrate
```

This command loads environment variables from the project-root `.env` file automatically, then creates the tables used by authentication, grocery lists, entries, and sharing.

### 5. Optionally load demo data

```bash
npm run db:seed
```

The seed creates one demo user, one shared list, and starter grocery entries for local development.

### 6. Start the app

```bash
npm run dev
```

This starts both apps concurrently:

- Frontend: Vite dev server on `http://localhost:5173`
- Backend: Express API on `http://localhost:4000`

During local development, the frontend Vite server proxies `/api` requests to `http://localhost:4000`, so the backend must be running before the browser can register, log in, or load list data.

### 7. Verify the setup

Open `http://localhost:5173/register` and create an account. If the environment file, database container, and migrations are in place, the registration request should succeed and the app should redirect into the protected grocery list UI.

## Docker Deployment

Use the example Compose file when you want to run the production-style single app container with PostgreSQL.

### Prerequisites

- Docker Desktop or Docker Engine with Docker Compose support

### Start the stack

Copy the example file and replace every `change-me` value before deploying:

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up -d
```

Compose pulls the app image from `ghcr.io/derfloDev/endgame-grocery`. The app listens on `http://localhost:80`. Nginx serves the built React app, proxies `/api/*` requests to the Node.js backend inside the same container, and returns the SPA `index.html` for deep-link routes. Database migrations run automatically when the app container starts.

The repository's checked-in `docker-compose.yml` is intentionally kept for local development and starts PostgreSQL only.

### Environment variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by migrations and the backend. | `postgres://postgres:change-me@postgres:5432/endgame_grocery` |
| `JWT_SECRET` | Secret used to sign authentication tokens. Replace with a strong random value. | `change-me-strong-random-value` |
| `PORT` | Internal backend port that nginx proxies to. | `4000` |
| `JWT_EXPIRES_IN` | JWT lifetime accepted by the backend. | `7d` |

## Validation

Run these checks before merging changes:

- `npm run lint`
- `npm run build`
- `npm test`

## E2E Tests

Playwright E2E coverage exercises the registration and login flows against the full local stack, so the PostgreSQL container must be running and the project-root `.env` file must be present first.

Install the Chromium browser once:

```bash
npx playwright install chromium
```

Run the suite with:

```bash
npm run e2e
```

The Playwright config reuses an already-running frontend or backend dev server when `CI` is not set. If neither server is running, Playwright starts `npm run dev --workspace backend` and `npm run dev --workspace frontend` automatically and waits for the health checks before running the browser scenarios.

## Available Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Starts the frontend and backend development servers concurrently. |
| `npm run build` | Builds the frontend production bundle and checks the backend entrypoint syntax. |
| `npm run lint` | Runs ESLint across all workspaces. |
| `npm test` | Runs frontend and backend test suites. |
| `npm run e2e` | Runs Playwright end-to-end tests against the full local stack. |
| `npm run migrate` | Applies backend PostgreSQL migrations. |
| `npm run db:seed` | Inserts demo data for local development. |

## CI/CD

GitHub Actions runs lint, build, unit tests, and Playwright E2E tests on every push and pull request. The E2E job provisions PostgreSQL, writes CI test environment variables, applies migrations, installs Chromium, and uploads Playwright artifacts when a run fails.

Release Please runs on `main` and opens release PRs based on Conventional Commits. Merging a release PR creates a GitHub Release and publishes Docker images to `ghcr.io/derfloDev/endgame-grocery` with the release version tag and `latest`.

Version bumps follow Conventional Commits: `feat` creates a minor release, `fix` creates a patch release, and breaking changes create a major release.

## Workspace Layout

- `frontend` contains the Vite + React application.
- `backend` contains the Express API and PostgreSQL integration.
- `.ai` contains planning, review, and handoff artifacts for the role workflow.

## Tech Stack

- Frontend: React, Vite, React Router, Vitest
- Backend: Node.js, Express, JWT authentication
- Database: PostgreSQL
- Tooling: ESLint, Prettier, Docker Compose

## Feature Overview

- The protected React app uses a dark Endgame-themed shell with bottom navigation for Lists and Search.
- Authentication supports register and login flows backed by JWT access tokens.
- Lists support create, rename, delete, ownership, and shared-access visibility.
- Entries support add, edit, toggle, and delete actions with open and done grouping.
- Sharing supports inviting registered users by email and revoking member access.
- Offline support caches successful reads and queues failed writes for replay after reconnect.

## AI Workflow

This project uses the persistent planner/implementer/reviewer workflow defined in `AGENTS.md`.
