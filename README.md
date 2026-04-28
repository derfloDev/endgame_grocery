<p align="center">
  <img src="endgame_grocery_logo.png" alt="Endgame Grocery" width="180" />
</p>

<p align="center">
  <img src="https://github.com/DerFloDev/endgame_grocery/actions/workflows/ci.yml/badge.svg" alt="CI" />
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-GPL%20v3-blue.svg" alt="License: GPL v3" />
  </a>
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

The backend requires a valid `DATABASE_URL` before registration, login, or list APIs can work. `JWT_SECRET` is fine for local development, but you must replace it with a strong secret outside local use. Mail-based flows also require SMTP credentials plus an `APP_BASE_URL` that points at the public frontend origin used in verification, invite, and password-reset links. Browser push also requires `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_CONTACT` so the backend can authenticate Web Push deliveries.

Backend commands that read configuration, including `npm run dev` and `npm run db:seed`, load this project-root `.env` file automatically even when npm starts them from the `backend/` workspace directory. The frontend Vite app also reads `VITE_*` values from the same repo-root `.env`, including `VITE_ICON_SIMILARITY_THRESHOLD`.

### 3. Start PostgreSQL

```bash
docker compose up -d
```

### 4. Run database migrations

```bash
npm run migrate
```

This command loads environment variables from the project-root `.env` file automatically, then creates the tables used by authentication, grocery lists, entries, sharing, and autocomplete history.

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

Open `http://localhost:5173/register` and create an account. If the environment file, database container, migrations, and SMTP settings are in place, the backend sends a verification email instead of logging you in immediately. Follow the `/verify-email` link from that message to activate the account and enter the protected grocery list UI. Shared-list invite mails use the same `APP_BASE_URL`: existing users land on `/invite/:token` and join after login, while new users can register through `/register?invite=...` and are added to the list immediately.

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
| `SMTP_HOST` | SMTP server hostname used for transactional mail delivery. | `smtp.change-me.example` |
| `SMTP_PORT` | SMTP server port. Port `465` enables implicit TLS; other ports use STARTTLS/plain transport as supported by the server. | `587` |
| `SMTP_USER` | SMTP username for authenticated mail delivery. | `change-me` |
| `SMTP_PASS` | SMTP password for authenticated mail delivery. | `change-me` |
| `SMTP_FROM` | Sender email address used for transactional mails. | `noreply@change-me.example` |
| `SMTP_FROM_NAME` | Sender display name shown in mail clients. | `Endgame Grocery` |
| `APP_BASE_URL` | Public frontend base URL used to build e-mail verification, invite, and reset links. | `https://grocery.change-me.example` |
| `VAPID_PUBLIC_KEY` | Public VAPID key exposed to the browser when users opt into push notifications. | `change-me` |
| `VAPID_PRIVATE_KEY` | Private VAPID key used by the backend push worker to sign outbound push deliveries. | `change-me` |
| `VAPID_CONTACT` | Contact URI sent with VAPID details, typically a `mailto:` address for operational issues. | `mailto:notifications@change-me.example` |
| `VITE_ICON_SIMILARITY_THRESHOLD` | Build-time similarity cutoff for local icon assignment in the frontend worker. Use a value from `0` to `1`; higher values require closer semantic matches before an icon is suggested. | `0.5` |

### Cloudflare Access

If you host the app behind Cloudflare Access, two bypass policies are required so the
PWA can install correctly:

| Path pattern | Reason |
| --- | --- |
| `/service-worker.js` | Service worker script — fetched without credentials by the browser's SW registration API |
| `/workbox-*.js` | Workbox runtime chunks loaded by the service worker |

The manifest (`/manifest.webmanifest`) does not need a bypass policy: the app already
sets `crossorigin="use-credentials"` on the manifest link so the browser sends the
`CF_Authorization` cookie with that request.

## Validation

Run these checks before merging changes:

- `npm run lint`
- `npm run build`
- `npm test`
- `npm run e2e`

## E2E Tests

Playwright E2E coverage exercises the registration, login, and core shopping-list CRUD flows against the full local stack, so the PostgreSQL container must be running and the project-root `.env` file must be present first.

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

The workflow files pin current maintained major versions of the GitHub-hosted actions so the pipeline stays compatible with GitHub's Node.js runtime upgrades.

Release Please runs after the `CI` workflow completes successfully on `main` and opens release PRs based on Conventional Commits. That CI gate prevents failed `main` builds from producing a release or publishing Docker images. Merging a release PR creates a GitHub Release and publishes Docker images to `ghcr.io/derfloDev/endgame-grocery` with the release version tag and `latest`.

Version bumps follow Conventional Commits: `feat` creates a minor release, `fix` creates a patch release, and breaking changes create a major release.

The repository is bootstrapped with `.release-please-manifest.json` and the baseline tag `v0.1.0`, so Release Please only calculates future versions from commits created after that cutoff.

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

- The protected React app uses a dark Endgame-themed shell with bottom navigation for Lists.
- The overview home screen uses a branded header, neon list cards, owner and shared status chips, and a bottom-sheet flow for creating new lists.
- Authentication supports register, email verification, password reset, and login flows backed by JWT access tokens.
- Lists support create, rename, delete, ownership, and shared-access visibility.
- The list detail view uses a sticky top bar, a more-options flyout for rename and sharing, a bottom-sheet add-item flow with an overlaid autocomplete suggestion dropdown that anchors to the input, an inline icon preview to the right of the field, a smoothly sliding icon browser, outside-tap dismissal, swipe-to-delete entry rows with optional detail text, and a recently used panel that updates immediately when items are completed or deleted.
- Entries support add, edit, toggle, and delete actions with open and done grouping, optional icons, and free-text details for quantities, brands, or similar context.
- The backend tracks per-list autocomplete history from completed and deleted items, exposes ranked typo-tolerant suggestions, and provides per-list recently used history endpoints.
- History chips and autocomplete suggestions fall back to the cart icon when no specific saved icon is available, so list rows keep a consistent visual layout.
- Sharing supports invite emails for existing and new users, direct invite-link acceptance after login, and revoking member access.
- Shared lists support browser push opt-in, batched activity notifications, actor exclusion, and cooldown-based suppression to avoid notification spam.
- Offline support caches successful reads and queues failed writes for replay after reconnect.

### Icon Assignment

New and edited entries can be assigned icons locally in the browser without sending item text to an external AI service. Exact EN/DE matches resolve immediately from the curated Tabler and Lucide icon catalogue, while broader terms fall back to a local `transformers.js` similarity check that suggests from the same expanded food, household, and health icon set. The picker shows human-readable labels such as `Ice Cream 2` instead of raw registry keys.

`VITE_ICON_SIMILARITY_THRESHOLD` controls how strict that semantic fallback is. Lower values suggest icons more aggressively, while higher values require a closer match before the worker returns an automatic suggestion.

The semantic matcher runs in an ES-module web worker so the ONNX runtime can initialise correctly in both development and production builds. If that worker crashes, the frontend recreates it on the next suggestion request instead of leaving the icon-loading spinner stuck indefinitely.

## AI Workflow

This project uses the persistent planner/implementer/reviewer workflow defined in `AGENTS.md`.

## License

This project is licensed under the [GNU General Public License v3.0](./LICENSE).
