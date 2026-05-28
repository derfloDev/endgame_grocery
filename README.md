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

## Screenshots

<p align="center">
  <img src="assets/demo_lists.png" alt="List overview" width="220" />
  &nbsp;&nbsp;&nbsp;
  <img src="assets/demo_listitems.png" alt="List detail with open items" width="220" />
  &nbsp;&nbsp;&nbsp;
  <img src="assets/demo_add_item.png" alt="Add item with icon picker" width="220" />
</p>

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

The Vite PWA plugin also enables the module service worker in dev mode, so localhost can exercise the same push-subscription flow as production. After updating the service worker code or switching branches, reload the page once before retesting push notifications so the browser picks up the latest dev worker.

In production, the protected app shell shows a dismissible update banner when a new service worker version is waiting. Use the banner's reload action to activate the new version immediately; dismissing it hides the prompt for the current browser session.

The frontend initializes i18next before React renders, detects English or German from local storage and the browser, and keeps the document `<html lang>` attribute aligned with the active language. Translation catalogs live in `frontend/src/locales/{en,de}/translation.json` and are delivered through Vite code splitting; JSON assets are included in the service worker precache patterns for offline-first locale support.

### 7. Generate VAPID keys for push notifications (optional)

Push notifications require a VAPID key pair. The `web-push` package bundled with the backend provides a one-shot generator:

```bash
node -e "const wp = require('web-push'); const k = wp.generateVAPIDKeys(); console.log(JSON.stringify(k, null, 2));"
```

The output looks like this:

```json
{
  "publicKey": "BNabc...xyz",
  "privateKey": "Kabc...xyz"
}
```

Copy the values into your `.env` file:

```
VAPID_PUBLIC_KEY=BNabc...xyz
VAPID_PRIVATE_KEY=Kabc...xyz
VAPID_CONTACT=mailto:you@example.com
```

**Key points:**
- Run the generator **once** and keep both values. Changing either key invalidates all existing browser push subscriptions, requiring users to opt in again.
- `VAPID_PRIVATE_KEY` is a secret — treat it like a password and never commit it to version control.
- `VAPID_CONTACT` must be a reachable `mailto:` address (or a URL). Push services use it to contact you if your endpoint misbehaves. Use a real address in production.
- If `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, or `VAPID_CONTACT` are missing, the backend starts normally but the push worker logs a warning and skips delivery. Users can still use the app; they simply will not receive push notifications.

### 8. Verify the setup

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

Container startup logs also print the app version twice: once from `docker/entrypoint.sh` before migrations and once in the backend JSON startup log entry.

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
| `REGISTRATION_ENABLED` | Runtime flag for self-registration. Leave unset or set to `true` to allow `/api/auth/register` and show the register UI; set to `false` to return `404` from registration and hide `/register` in the frontend. | `true` |
| `VAPID_PUBLIC_KEY` | Public VAPID key sent to the browser so it can create a `PushSubscription`. Generate once with `node -e "const wp=require('web-push');const k=wp.generateVAPIDKeys();console.log(k.publicKey)"` inside the `backend/` directory. Changing this key invalidates all existing subscriptions. | *(generated — see below)* |
| `VAPID_PRIVATE_KEY` | Private VAPID key used by the backend push worker to sign outbound Web Push requests. **Treat as a secret.** Generated together with `VAPID_PUBLIC_KEY`; the two keys must always be used as a pair. | *(generated — see below)* |
| `VAPID_CONTACT` | Contact URI included in the VAPID `Authorization` header so push services can reach you if deliveries fail. Must be a `mailto:` address or an HTTPS URL. | `mailto:notifications@change-me.example` |
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

Frontend Vitest runs load `frontend/src/test/setup.ts` before each suite so component
tests start with the i18next runtime initialized and the language reset to English.
The frontend Vitest config uses 20-second test and hook timeouts to keep the full
parallel suite stable on slower local machines. The frontend TypeScript setup allows
existing JavaScript modules during the staged TSX migration so converted entry points
can continue importing files that move in later tasks.

## E2E Tests

Playwright E2E coverage exercises the registration, login, and core shopping-list CRUD flows against the full local stack, so the PostgreSQL container must be running and the project-root `.env` file must be present first. The non-production backend also exposes `POST /api/test/create-verified-user` specifically for E2E setup, and transactional mail delivery is skipped with a warning when `SMTP_HOST` is not configured.

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

Release Please runs after the `CI` workflow completes successfully on `main` and opens release PRs based on Conventional Commits. That CI gate prevents failed `main` builds from producing a release PR. The workflow uses the `RELEASE_PLEASE_TOKEN` repository secret so the published GitHub Release is emitted as a normal user action and can trigger downstream workflows. Publishing that GitHub Release triggers the dedicated Docker publish workflow, which pushes images to `ghcr.io/derfloDev/endgame-grocery` with the release version tag and `latest`.

Version bumps follow Conventional Commits: `feat` creates a minor release, `fix` creates a patch release, and breaking changes create a major release.

The repository is bootstrapped with `.release-please-manifest.json` and the baseline tag `v0.1.0`, so Release Please only calculates future versions from commits created after that cutoff.

## Workspace Layout

- `frontend` contains the Vite + React application.
- `backend` contains the Express API and PostgreSQL integration.
- `.ai` contains planning, review, and handoff artifacts for the role workflow.

## Tech Stack

- Frontend: React, Vite, React Router, i18next, Vitest
- Backend: Node.js, Express, JWT authentication
- Database: PostgreSQL
- Tooling: ESLint, Prettier, Docker Compose

## Feature Overview

- The protected React app uses a dark Endgame-themed shell with bottom navigation for Lists.
- The frontend has English and German localization infrastructure with browser language detection, persistent language preference storage, and a DE/EN switcher in the Info & Settings sheet.
- The overview home screen uses a branded header, neon list cards, owner and shared status chips, and a bottom-sheet flow for creating new lists.
- Authentication supports register, email verification, password reset, and login flows backed by JWT access tokens.
- When a protected API request reports an expired JWT, the frontend clears the local session, redirects to `/login`, shows a session-expired hint, and returns the user to their original protected page after a successful login.
- Authenticated users can manage their Home Assistant API key from the Info & Settings sheet, including generating, copying, and replacing the key. The frontend uses `GET /api/auth/api-key` to read the current key and `POST /api/auth/api-key` to generate or replace it; both endpoints require the same JWT bearer token as the protected app.
- External clients can use the Home Assistant oriented `/api/v1` REST API with `X-Api-Key: <key>` instead of a JWT. It exposes `GET /api/v1/lists`, `GET /api/v1/lists/:listId/items`, `POST /api/v1/lists/:listId/items`, `POST /api/v1/lists/:listId/items/:itemId/toggle`, `PATCH /api/v1/lists/:listId/items/:itemId`, and `DELETE /api/v1/lists/:listId/items/:itemId`; path IDs must be UUIDs, invalid IDs return 404, and item statuses are returned as raw entry values, `open` or `done`. Item create, toggle, rename, and delete mutations emit the same SSE entry events as the authenticated app routes so connected web clients refresh without a manual reload.
- API documentation is available as Swagger UI at `GET /api/docs/`; `GET /api/docs` redirects there so relative Swagger UI assets load correctly. The raw OpenAPI 3.1 YAML is served from `GET /api/docs/openapi.yaml`.
- When a browser still has a valid JWT but has lost the cached `endgame_grocery.auth_user` entry, the frontend rehydrates `display_name` and `email` from `GET /api/auth/me` so the Info & Settings sheet still shows the signed-in identity after reload.
- Lists support create, rename, delete, ownership, and shared-access visibility.
- The overview refetches lists when list rename/delete SSE events arrive, and the list detail page refetches the active list's entries or members when matching entry/member SSE events arrive over `GET /api/events?token=<jwt>`.
- The authenticated frontend keeps one shared SSE connection open while a JWT is present, then closes it again on logout so pages can subscribe to list-scoped events without creating their own connections.
- The list detail view uses a sticky top bar, a more-options flyout for rename and sharing, a bottom-sheet add-item flow with an overlaid autocomplete suggestion dropdown that anchors to the input, an inline icon preview to the right of the field, a smoothly sliding icon browser, outside-tap dismissal, swipe-to-delete entry rows with optional detail text, and a recently used panel that updates immediately when items are completed and preserves optional details when re-adding history items.
- Entries support add, edit, toggle, and delete actions with open and done grouping, optional icons, and free-text details for quantities, brands, or similar context.
- The authenticated entries API limits each list to 1,000 open entries, returning HTTP 422 when adding another open item would exceed the cap; marking an item done auto-removes the oldest done entry when a list already has 200 done entries.
- The backend derives per-list recently used items and typo-tolerant autocomplete suggestions from saved entries, including saved icons and details where available.
- History chips and autocomplete suggestions fall back to the cart icon when no specific saved icon is available, so list rows keep a consistent visual layout.
- Sharing supports invite emails for existing and new users, direct invite-link acceptance after login, and revoking member access.
- Shared lists support browser push opt-in, batched activity notifications, actor exclusion, and cooldown-based suppression to avoid notification spam.
- Offline support caches successful reads and queues failed writes for replay after reconnect, when the app becomes visible again, or when a new queued write is added while the browser is online; non-retriable queued write failures show a discard action so the remaining queue can continue.

### Icon Assignment

New and edited entries can be assigned icons locally in the browser without sending item text to an external AI service. Exact EN/DE matches resolve immediately from the curated Tabler, Lucide, and custom SVG icon catalogue, including enriched synonym, regional, brand-name, and compound-word matches for grocery, produce, household, clothing, and drugstore items. Dedicated food, produce, drugstore, and household entries such as tomatoes, onions, rice, frozen food, snacks, dairy staples, shampoo, mouthwash, cleaning supplies, and paper goods use specific registry icons instead of generic category fallbacks. Broader terms fall back to a local `transformers.js` similarity check that suggests from the same expanded icon set. The picker shows human-readable labels such as `Ice Cream 2` instead of raw registry keys.

Hand-crafted custom icons live as SVG files in `frontend/src/assets/icons/custom/` and are imported with `*.svg?react` through `vite-plugin-svgr`. Wrap new SVG imports with `normalizeCustomIcon` in `frontend/src/data/customIcons.js`, export them with a `Custom` prefix, and register those exports in `ICON_REGISTRY` so they render with the same `size`, `stroke`/`strokeWidth`, and `color` props as Tabler and Lucide icons.

`VITE_ICON_SIMILARITY_THRESHOLD` controls how strict that semantic fallback is. Lower values suggest icons more aggressively, while higher values require a closer match before the worker returns an automatic suggestion.

The semantic matcher runs in an ES-module web worker so the ONNX runtime can initialise correctly in both development and production builds. If that worker crashes, the frontend recreates it on the next suggestion request instead of leaving the icon-loading spinner stuck indefinitely.

## AI Workflow

This project uses the persistent planner/implementer/reviewer workflow defined in `AGENTS.md`.

## Built With

This project is vibe-coded with aide, the AI workflow tooling from [agentinit](https://github.com/riadshalaby/agentinit).

## Support

<a href="https://www.buymeacoffee.com/derflodev">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="40" />
</a>

[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-support-EA4AAA?logo=githubsponsors)](https://github.com/sponsors/DerFloDev)

## License

This project is licensed under the [GNU General Public License v3.0](./LICENSE).
