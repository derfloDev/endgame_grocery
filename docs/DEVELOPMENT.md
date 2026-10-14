# Development

This guide is for working on the code: the local development environment, performance notes, tests and validation, architecture conventions, scripts, CI/CD, the behavior and API reference, icon assignment and the AI workflow. To install and operate a deployment instead, see [Setup](SETUP.md). Back to the [README](../README.md).

## Contents

- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Performance and offline precache](#performance-and-offline-precache)
- [Testing and validation](#testing-and-validation)
- [Architecture and conventions](#architecture-and-conventions)
- [Available Scripts](#available-scripts)
- [CI/CD](#cicd)
- [Workspace Layout](#workspace-layout)
- [Tech Stack](#tech-stack)
- [Behavior and API reference](#behavior-and-api-reference)
- [Icon Assignment](#icon-assignment)
- [AI Workflow](#ai-workflow)

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

The backend requires a valid `DATABASE_URL` before registration, login, or list APIs can work. `JWT_SECRET` must be at least 32 characters and must not contain `change-me`; the backend logs the problem and exits with code 1 at startup if `DATABASE_URL` is missing or the secret is empty, too short, or a placeholder. Generate one with `openssl rand -base64 48`. Mail-based flows also require SMTP credentials plus an `APP_BASE_URL` that points at the public frontend origin used in verification, invite, and password-reset links. Browser push also requires `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_CONTACT` so the backend can authenticate Web Push deliveries.

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

Optional follow-up steps: generate VAPID keys for push notifications (see [Push notifications](SETUP.md#push-notifications)) and check the result by registering an account (see [Verify the installation](SETUP.md#verify-the-installation)).

## Performance and offline precache

### Cold-load assets and offline precache

The cold-load target for `/lists/<id>` is below 500 KiB transferred, with no single response over 150 KiB. The PWA keeps 192×192 and 512×512 any-maskable PNG icons, and the app logo remains a 256×256 PNG rendered at 40–44 px. The self-hosted fonts and app shell are precached for offline use, and the service worker routes app navigations to the cached shell when offline. The icon-matching worker is excluded from that initial precache because `iconWorkerClient.ts` creates it only when a user opens the add-item flow.

A clean authenticated Chromium run against Vite's production preview transferred 655,775 bytes (640.4 KiB) across 25 responses. Seven hashed asset paths were requested both by the page and by service-worker precaching, and preview returned full 200 responses for both copies because it sends no-cache headers. This preview measurement exceeds the target and does not represent the deployed cache behavior.

Render cost and bundle size: the signed-out pages (login, register, forgot/reset password, verify email, invite acceptance) and the Share, Rename, Options, Info and Add/Edit item sheets are separate lazy chunks (`React.lazy`; sheets are fetched when first opened via `DeferredSheet`), all included in the service worker precache so they work offline. The startup entry chunk is 311 KB raw / 87.2 KB gzip (previously 370 KB / 103 KB; budget < 100 KB gzip). `EntryTile` is memoised and receives the original entry object plus one stable `onEdit(id)` / `onToggle(id)` handler, the open/visible entry lists are memoised and the search term is deferred (`useEntryTiles`), and the auth and offline-queue context values are memoised, so typing in the search field or an unrelated parent update no longer re-renders unchanged tiles. `exo-2-latin.woff2` is preloaded from `index.html`, and `icon-192.png` was re-encoded from 55.9 KB to 11.7 KB (192×192, 256-colour palette, still `any maskable`; a lossless re-encode could not get below 49 KB because the image has about 15,000 colours, PSNR of the palette version is 34 dB).

Re-measured cold load of `/lists/<id>` (Chromium via Playwright against `vite preview` of the production build, API mocked, page requests only, measured with CDP `encodedDataLength`): 8 responses, 214,743 bytes (209.7 KiB), largest response 87,589 bytes (85.5 KiB; the entry chunk), so both the 500 KiB total and the 150 KiB per-response budget are met. This measurement does not include the service worker's precache requests, which the previous measurement counted; those are served from the HTTP cache for assets the page already fetched when the immutable cache headers of the production Nginx configuration apply.

The frontend initializes i18next before React renders, detects English or German from local storage and the browser, and keeps the document `<html lang>` attribute aligned with the active language. Translation catalogs live in `frontend/src/locales/{en,de}/translation.json` and are delivered through Vite code splitting; JSON assets are included in the service worker precache patterns for offline-first locale support.

## Testing and validation

### Validation

Run these checks before merging changes:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm run test:integration` (needs `TEST_DATABASE_URL`, see below)
- `npm run e2e`

### Production nginx image smoke check

On Linux, install Bash, Docker (with a running Linux-container daemon), curl and standard tools
(awk, sed, grep, gzip, cmp, wc, mktemp, sleep and rm), then run:

```bash
docker build -t endgame-grocery:nginx-smoke .
bash docker/smoke-nginx.sh endgame-grocery:nginx-smoke
```

The build fails on an invalid installed nginx configuration via `RUN nginx -t`. The independent
`nginx-smoke` CI job runs these same commands on pull requests and pushes to main without
publishing an image. Missing Docker or host tools fail the smoke check rather than skipping it.
The independent `nginx-smoke-arm64` CI job does the same for the `linux/arm64` image under QEMU, and additionally asserts `uname -m` is `aarch64` and that the native `bcrypt` module loads.
The script accepts an already-built local image tag, checks `nginx -t` again and starts nginx on a
dynamically allocated localhost port. It checks HTTP 200 for the shell, service worker, a discovered
hashed JS/CSS asset and a SPA route; verifies the SPA returns the shell, one expected Cache-Control
header and all four security headers per response; and verifies gzip/Vary and decompressed asset
bytes against the identity response. Readiness polling is bounded, failures print container logs,
and cleanup removes only the script's own container and temporary files.

This overrides the image entrypoint to run nginx alone: it needs no database and does not exercise
migrations, supervisord, backend health, authenticated API traffic, full application startup or
browser E2E. The cold-load measurements above remain browser measurements against Vite preview.
Unit tests retain coverage of font, icon and manifest cache rules and gzip level 5.

#### arm64 variant

Building and running the arm64 image needs Docker Buildx plus QEMU/binfmt emulation (built into Docker Desktop; on Linux, for example `docker run --privileged --rm tonistiigi/binfmt --install arm64`):

```bash
docker buildx build --platform linux/arm64 --load -t endgame-grocery:nginx-smoke-arm64 .
DOCKER_DEFAULT_PLATFORM=linux/arm64 bash docker/smoke-nginx.sh endgame-grocery:nginx-smoke-arm64
```

### Integration tests

`backend/src/integration/` holds tests that run real SQL against PostgreSQL 16: access checks
(owner, member, stranger) through `createApp({ pool })` and a migration round-trip
(up → down → up with an identical column, index and constraint snapshot). `helpers.js` creates a
uniquely named schema per test file, applies all migrations into it with node-pg-migrate, hands the
tests a `pg.Pool` bound to that schema and drops the schema afterwards, so test files can run in
parallel against one database. It also exports seed helpers (`createUser`, `createList`,
`addMember`, `createEntry`, `createInvite`) and `signTestToken`. New SQL changes should add a test
here.

The query-index migration is also checked with the real node-pg-migrate SQL builder in the unit
suite and against PostgreSQL's index catalog in the integration suite. Its GIN index must use
`gin_trgm_ops` on the `text` column; node-pg-migrate ignores an index-level `opclass` option.
The integration migration runner keeps `public` after the isolated test schema in its search
path so it can resolve the shared extensions, while migration tracking stays in the test schema.

The tests need a database that is safe to create and drop schemas in. Create a separate one and
point `TEST_DATABASE_URL` at it:

```bash
docker exec endgame_grocery_postgres createdb -U postgres endgame_grocery_test
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/endgame_grocery_test npm run test:integration
```

Without `TEST_DATABASE_URL` every integration suite is skipped with a clear reason, so `npm test`
stays green on machines without PostgreSQL. CI always sets the variable.

### Playwright PWA regression

Run the isolated production browser regression after building:

```bash
npm run build
npx playwright test --config playwright.pwa.config.js
```

This starts Vite preview at `http://127.0.0.1:4173` with reuse disabled, uses deterministic API
fixtures without PostgreSQL, and tests real registration, precaching, activation, offline
shell/list reads and same-page failure recovery in clean Chromium contexts. A local HTTP
proxy injects redirects, failed precaching and an obsolete manifest referencing a retired JavaScript
chunk returning 404 while page assets remain current. The stale-worker check observes real
redundant installation, localized feedback, no subscription persistence before recovery and
retry without page navigation. PushManager subscription transport and notification permission
are stubbed for UI/API assertions; these checks do not prove real push delivery. The existing
development E2E suite remains separate. Android Chrome/Brave installation, opt-in, subscription
restoration after reload, delivery from another member and click navigation still require
checks on actual devices at the deployment; desktop emulation does not replace them.

### E2E Tests

Playwright E2E coverage exercises the registration, login, and core shopping-list CRUD flows against the full local stack, so the PostgreSQL container must be running and the project-root `.env` file must be present first. The backend only exposes `POST /api/test/create-verified-user` for E2E setup when `ENABLE_TEST_ROUTES=true` (Playwright sets it for its backend dev server and the CI `.env` includes it; the production image never enables it), and transactional mail delivery is skipped with a warning when `SMTP_HOST` is not configured.

Install the Chromium browser once:

```bash
npx playwright install chromium
```

Run the suite with:

```bash
npm run e2e
```

The Playwright config reuses an already-running frontend or backend dev server when `CI` is not set. If neither server is running, Playwright starts `npm run dev --workspace backend` and `npm run dev --workspace frontend` automatically and waits for the health checks before running the browser scenarios.

`npm run e2e -- e2e/sharing.spec.js` uses two isolated browser contexts and the real API/SSE stream: the owner invites a member, the member accepts, a new item appears without reloading, and revocation sends the member to the overview. It requires `DATABASE_URL` (environment or root `.env`) to point to the same disposable test database as the backend. Because CI has no SMTP inbox and invitation tokens are stored only as hashes, the fixture replaces the newly created invite's hash with a known random token before opening its link. It does not verify email delivery. The test deletes its users and their dependent data afterwards. Stream readiness, responses and visible UI changes control the sequence; the cold-load list test also waits for an idle rendering turn instead of a fixed delay.

Unit coverage includes stranger entry access and non-owner sharing with no side effects, push subscription validation/authentication, auth-page submission and redirect behavior, and service-worker push/click handling. `backend/src/integration/access.test.js` repeats access checks against real PostgreSQL and verifies that rejected requests cannot alter entries, memberships, invites or pending push jobs, including cross-list entry IDs.

The invite acceptance page reuses its request for the same invite and auth token when React StrictMode or a language change replays the effect. This prevents a successful single-use acceptance from being replaced by a second request's expired-token error. A different invite or signed-in session starts a fresh request.

`npm run e2e -- e2e/resync.spec.js` runs the browser resync checks with controlled API responses and SSE/lifecycle events, covering foreground refresh, reconnect deduplication, and content remaining visible during detail reloads. These scenarios use the normal dev servers but do not require database fixtures. Real-device background suspension still needs a separate smoke test.

`npm run e2e -- e2e/queue-retry.spec.js` verifies automatic queue retries after a page wake-up and recovery across a reload using real browser IndexedDB, controlled API responses and the Playwright clock. It checks that successful parent creates are not resent and dependent writes retain their resolved IDs. These scenarios also run without database fixtures.

## Architecture and conventions

### Frontend types

The shared domain types live in `frontend/src/types.ts` and mirror the API: `Entry` (with nullable `details`), `List` (with `owner_id` / `owner_name`), `Member` (`user_id`, `display_name`, `email`, ...). Pages and hooks use them directly; there are no per-page `Detail*` copies. `sendJsonRequest<T>` resolves to the type the caller states, so the `api/*.ts` helpers return typed responses without casts. A write request resolves to `MutationResult<T>`, a union of `{ queued: true }` (the offline queue accepted it) and the server's answer `T`; narrow it with `if (result.queued)`. `api/apiTypes.test.ts` pins these types at compile time and fails if a `Detail*` type reappears.

### List detail hooks

`useListDetailData` is a thin facade over three focused hooks in `frontend/src/pages/ListDetailPage/`: `useListEntries` (entries, optimistic create/toggle/edit, SSE patches), `useListMembers` (sharing) and `useRecentlyUsed` (history suggestions). `useActiveList` supplies the `isMounted()` / `isCurrent(listId)` guards that drop results of a list the user already left. The hooks expose state and commands only (`addEntry`, `revokeMember`, `resync`, ...), never raw `set*` setters.

Errors are typed (`ListDetailError` in `listDetailErrors.ts`: `kind` is `access` or `request`, plus the stable API `code`). They are translated when rendered with `getListDetailErrorText`, so they follow language changes. Offline cache keys come from `createEntriesCacheKey`, `createMembersCacheKey`, `createListCacheKey` and `LISTS_CACHE_KEY`; SSE event names come from `SSE_EVENTS` in `api/sseEvents.ts`. `sharedNames.test.ts` fails when a key or event-name literal is spelled out elsewhere.

Frontend Vitest runs load `frontend/src/test/setup.ts` before each suite so component
tests start with the i18next runtime initialized and the language reset to English.
The frontend Vitest config uses 20-second test and hook timeouts to keep the full
parallel suite stable on slower local machines. The frontend TypeScript setup allows
existing JavaScript modules during the staged TSX migration so converted entry points
can continue importing files that move in later tasks.

App integration tests use `frontend/src/test/fetchRoutes.ts`: register a method and a literal
pathname (including its query) or a RegExp with `routes.on("GET", "/api/lists", () => ({ json: async () => ({ lists: [] }) }))`,
then stub global fetch with `routes.fetch`. Handlers return response fixtures, promises for
loading states, or throw for network failures. The last matching registration wins, so a test
can override a default route. Reset the table before each test and call `routes.assertAllMatched()`
after cleanup: an unexpected request rejects immediately and fails teardown even when the app
catches the error. Use `routes.fetch.mock.calls` for explicit request counts and ordering checks;
keep intentional retry or SSE response sequences local to the route they describe.

Recently completed items stay at the front of Recently Used in completion/history order,
independent of when the entries were created. Changed items retain their details and badges;
items awaiting their history update appear ahead of known history items.

## Available Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Starts the frontend and backend development servers concurrently. |
| `npm run build` | Builds the frontend production bundle and checks the backend entrypoint syntax. |
| `npm run lint` | Runs ESLint across all workspaces. |
| `npm run typecheck` | Runs `tsc --noEmit` on the frontend, including its tests. Zero errors are required and CI runs it in the lint job. |
| `npm test` | Runs frontend and backend test suites. |
| `npm run test:integration` | Runs the backend PostgreSQL integration tests (requires `TEST_DATABASE_URL`). |
| `npm run e2e` | Runs Playwright end-to-end tests against the full local stack. |
| `npm run migrate` | Applies backend PostgreSQL migrations. |
| `npm run db:seed` | Inserts demo data for local development. |

## CI/CD

GitHub Actions runs lint, the frontend type check (`npm run typecheck`), build, unit tests, and Playwright E2E tests on every push and pull request. The unit-test job starts a `postgres:16` service, creates the `endgame_grocery_test` database, runs `npm test`, and then runs `npm run test:integration` with `TEST_DATABASE_URL` set. The E2E job provisions PostgreSQL, writes CI test environment variables, applies migrations, installs Chromium, and uploads Playwright artifacts when a run fails.

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

## Behavior and API reference

The complete, detailed list of implemented behavior, grouped by area. The user-facing summary is the Features section of the [README](../README.md).

### Accounts and authentication

- Authentication supports register, email verification, password reset, and login flows backed by JWT access tokens. Each token carries the user's `token_version` (`tv` claim) and every authenticated request, including opening the event stream, checks it against `users.token_version` (one primary-key lookup), so a deleted user or a stale token gets `401`. A password reset consumes its token with a single conditional `UPDATE … WHERE used = false` inside a transaction (two concurrent resets with one link: exactly one succeeds), increments `token_version` (every other session is signed out; tokens issued before this feature carry no `tv` and count as version 0 until the first reset), deletes the user's other reset tokens and clears the Home Assistant API key. The success message after a reset tells the user to sign in again and generate a new API key.

- When a protected API request reports an expired JWT, the frontend clears the local session, redirects to `/login`, shows a session-expired hint, and returns the user to their original protected page after a successful login.

- Authenticated users can manage their Home Assistant API key from the Info & Settings sheet. The key and every one-time token (email verification, password reset, list invite) are stored only as SHA-256 hashes (`users.api_key_hash`, `*.token_hash`); the plaintext exists only in the response or mail that delivers it. Existing keys and pending links were converted in place by the migration, so they keep working (`down` cannot restore plaintext: it re-creates empty API keys and random token values). `GET /api/auth/api-key` returns only `{ has_key, hint, created_at }` (`hint` = last four characters); `POST /api/auth/api-key` generates a key, replaces the previous one and returns `{ api_key, hint, created_at }` once. The sheet shows the new key with a copy button and a "shown only once" warning, afterwards `•••• <hint>` with a confirmed Regenerate action. All endpoints require the same JWT bearer token as the protected app.

- When a browser still has a valid JWT but has lost the cached `endgame_grocery.auth_user` entry, the frontend rehydrates `display_name` and `email` from `GET /api/auth/me` so the Info & Settings sheet still shows the signed-in identity after reload.

### Integration API and docs

- External clients can use the Home Assistant oriented `/api/v1` REST API with `X-Api-Key: <key>` instead of a JWT. It exposes `GET /api/v1/lists`, `GET /api/v1/lists/:listId/items`, `POST /api/v1/lists/:listId/items`, `POST /api/v1/lists/:listId/items/:itemId/toggle`, `PATCH /api/v1/lists/:listId/items/:itemId`, and `DELETE /api/v1/lists/:listId/items/:itemId`; path IDs must be UUIDs, invalid IDs return 404, and item statuses are returned as raw entry values, `open` or `done`. Both APIs run on one shared entry service (`backend/src/services/entryService.js`), so v1 create, toggle, rename, and delete behave exactly like the app routes: they record `last_updated_by`, enforce the limits (create answers `422` at 1,000 open items; completing an item at 200 done items evicts the oldest), emit the same SSE entry events, and item creation queues the same push notification. A v1 `description` is trimmed and a blank one is stored as `null`; a value that is not a string or `null` is rejected with `400`.

- API documentation is available as Swagger UI at `GET /api/docs/`; `GET /api/docs` redirects there so relative Swagger UI assets load correctly. The raw OpenAPI 3.1 YAML is served from `GET /api/docs/openapi.yaml`.

### Lists and entries

- Lists support create, rename, delete, ownership, and shared-access visibility.

- `GET /api/lists/:id` returns the metadata of one list (`id`, `name`, `owner_id`, `owner_name`, `is_owner`, `created_at`) for owners and members (`403` for everyone else, `404` for a malformed id), so the detail page does not have to load every list. The frontend helper `fetchList` caches it under `list:<id>`. Migration `1779979000004_add_query_indexes` creates the `pg_trgm` extension explicitly and adds indexes for the entries, history, suggestions, overview and push queries (`entries(list_id, status, created_at)`, `entries(list_id, updated_at)`, a trigram GIN index on `entries(text)`, `lists(owner_id)`, `list_members(user_id)`, `pending_push_jobs(fire_at)`, `push_subscriptions(endpoint)`); the integration suite checks with `EXPLAIN` that none of these queries scans `entries` sequentially. Its `down` drops the indexes but keeps the extension.

- Shared lists track each user's last viewed timestamp. `GET /api/lists` includes `changed_count`, `created_at`, and `last_activity` (the newest entry update, falling back to list creation), `GET /api/lists/:id/entries` includes `is_changed`, and `POST /api/lists/:id/mark-viewed` records the open so badges disappear on the next list load; changes made by the current user are not counted. Changed done entries stay out of Open Items and appear in Recently Used with a Done badge, including items completed locally in the current session; if the same item text is open again, Recently Used suppresses the older done entry.

- Shared members can leave from the overview or list options after confirmation; this removes their access through `DELETE /api/lists/:id/leave`, while owners cannot leave their own lists and receive an email when a member leaves.

- The overview sorts lists by creation date, name, or latest activity and persists the selected order in local storage under `overview_sort`.

- The list detail view uses a sticky top bar, filters open items by name or optional details through an always-visible search field, provides a more-options flyout for rename and sharing, and includes a bottom-sheet add-item flow with an overlaid autocomplete suggestion dropdown that anchors to the input, an inline icon preview to the right of the field, a smoothly sliding icon browser, outside-tap dismissal, scroll-safe entry tiles with optional detail text and long-press editing, and a recently used panel that updates immediately when items are completed, preserves optional details when re-adding history items, and lets users dismiss history chips by deleting matching completed entries for every connected list member.

- Entries support add, edit, toggle, and delete actions with open and done grouping, optional icons, and free-text details for quantities, brands, or similar context.

- The authenticated entries API limits each list to 1,000 open entries, returning HTTP 422 when adding another open item would exceed the cap; marking an item done auto-removes the oldest done entry when a list already has 200 done entries. Creating an entry and completing one run in a transaction that locks the list row, so concurrent requests cannot exceed the open cap; the oldest done entry is evicted only when the entry being completed exists and is currently open (an unknown or already done entry deletes nothing).

- The backend derives per-list recently used items and typo-tolerant autocomplete suggestions from saved entries, including saved icons and details where available.

- History chips and autocomplete suggestions fall back to the cart icon when no specific saved icon is available, so list rows keep a consistent visual layout.

- Sharing supports invite emails for existing and new users, direct invite-link acceptance after login, and revoking member access. An invite is bound to the email address it was sent to: accepting it with a different account answers `403` (the page names the signed-in account and offers to switch), the list owner gets `409` and the invite stays pending, and acceptance is atomic and single use (one conditional `UPDATE … WHERE status = 'pending'` plus the membership insert in one transaction; a second use answers `400`). Registering with an invite for another email address creates an unverified account that does not join the list.

- Shared lists support browser push opt-in, batched activity notifications, actor exclusion, and cooldown-based suppression to avoid notification spam.

- The list detail page loads its initial data once per visit; loading or switching translations does not repeat the requests. It requests only its own list through `GET /api/lists/:id` (cached as `list:<id>`; offline and never opened before, the overview cache supplies the title and owner) instead of loading every list, and reads cached list and entry data alongside the network request, showing the last known entries as soon as the local cache is read without waiting for the server. Fresh responses replace cached content while preserving queued local additions and completion badges; late cache reads cannot overwrite a settled response. Without cached entries, the loading indicator remains until the list, entries and history responses are ready. A `403` or `404` for the list shows the access error. Network failures still use the existing offline-cache fallback, and access errors clear the cached view. Members have a separate loading indicator in the sharing sheet; a failed member request shows an error while keeping the list and entries visible. Access-denied messages follow the current language without refetching the list.

- The overview is cache-first as well: cached lists render as soon as the local cache is read and the skeleton only appears on a first load with nothing cached. Reloads caused by events, reconnects or finished syncs refresh the lists in place without the skeleton, and a failed refresh keeps the lists on screen (the error state is only shown when there is nothing to show).

### Live updates (SSE)

- The overview refetches lists when list rename/delete SSE events arrive, and the list detail page refetches the active list's entries, members, or recently used history when matching entry/member/history SSE events arrive over `GET /api/events?ticket=<ticket>`. Both views also refresh after a confirmed SSE reconnect or a hidden-to-visible transition with a healthy stream. A shared `resyncVersion` deduplicates these recovery triggers within 2 s and excludes the first connection because pages already load on mount. Detail resync refreshes entries, history and owner-visible members in place without showing the full-page loader; local pending entries absent from the server remain visible with their queued state during both recovery and regular SSE refetches.

- The authenticated frontend shares one SSE connection while a JWT is present. Closed streams reconnect with exponential backoff starting at 1 s, ±30% jitter, and a final delay capped at 30 s; browser-managed retries continue until a 45 s watchdog detects silence. Returning to a visible tab or receiving an `online` event reconnects an unhealthy stream immediately. Logout and unmount close the stream and cancel its timers. The provider exposes `connectionState` (`connecting`, `open`, or `closed`) with a stable event subscription function; its optional `timings` prop overrides the SSE constants in `frontend/src/api/connectionTimings.ts` for tests.

- `POST /api/events/ticket` (Bearer JWT) issues a single-use ticket that is valid for 30 s; the browser requests a fresh one before every connect and reconnect and opens `GET /api/events?ticket=<ticket>`, so the JWT never appears in a URL. A failed ticket request counts as a failed connection attempt and goes through the normal reconnect backoff, and a `401` signs the user out. `?token=` is no longer accepted; non-browser clients may send an `Authorization: Bearer` header to `GET /api/events` instead. Tickets are kept in memory, which fits the single-instance deployment.

- Entry events carry their data, so other clients patch instead of refetching: `entry:created` and `entry:updated` send `{ listId, entryId, actorId, entry }` (the entry has the fields of the entries GET without `is_changed`) and `entry:deleted` sends `{ listId, entryId, actorId, entryStatus }`. The detail page upserts or removes the entry by id, idempotently (the same event twice, or the actor's own change that the client already holds, changes nothing), keeps queued local entries and the done badges of entries completed on that client, ignores events about an entry whose own request is still in flight, marks other users' changes as changed, and sorts open entries before done ones. A toggle on one device therefore causes no `/entries` request on the others. The server announces a new entry before the HTTP response of the creating tab arrives, so that tab ignores its own `entry:created` event while its create request for the same text is still running and, when the response arrives, replaces the queued entry and any copy with the same id by the server's entry; an added item therefore never shows twice. The recently used history is reloaded only when an entry moved to or from done or a done entry was deleted, debounced by 250 ms so several completions cause one request. A resync (reconnect, return to foreground, sync version) still refetches everything, and an event without a usable payload (an older server) falls back to a full refetch.

- List lifecycle events reach everyone affected. `member:removed` is sent to the user who was removed (by the owner) or who left, directly, because after the delete they are no longer a list recipient, and to the remaining owner and members through the normal list broadcast. `list:deleted` goes to the owner and all members: the recipients are read before the delete and the event is sent only after the delete succeeded, and a failing recipient lookup or notification never prevents the deletion. On the list detail page, `list:deleted` or `member:removed` about the current user returns to the overview with a translated notice (DE/EN), `list:updated` refreshes only the list metadata so a rename shows in place, and `member:removed` about somebody else refreshes the member list. The overview drops a deleted list or one the current user was removed from immediately.

- `GET /api/events` emits a named `ping` event every 30 s with JSON data `{"ts":"<ISO timestamp>"}`. Heartbeats and application events refresh the client's watchdog. Clients that do not register a `ping` listener ignore these frames, and normal list events keep their existing names and payloads.

### Offline and sync

- Offline support caches successful reads and queues failed writes for replay when server reachability is confirmed. Browser online/offline events, returning to a visible page, page restoration (`pageshow`), focus and queue changes recheck reachability when work is queued; an empty queue does not trigger a startup probe. A failed real request also refreshes the shared reachability state so the offline banner remains accurate. The browser's online flag is only a hint: shared `/api/health` probes bypass the cache, time out after 5 seconds and run at most once per 5-second window; an open live-update stream confirms connectivity without a probe, and HTTP responses also confirm reachability. Non-retriable queued write failures show a discard action so the remaining queue can continue. Exo 2, Orbitron and JetBrains Mono are self-hosted as Latin and extended-Latin WOFF2 files in `frontend/public/fonts/` and precached for offline use; their SIL Open Font Licenses and attribution are included alongside the files.

- API requests, including queued writes and response-body reads, time out after 10 seconds. Timed-out reads fall back to cached data and queueable writes enter the offline queue. Network failures, timeouts and server errors during replay retry automatically after 1, 2, 4 seconds and so on, capped at 60 seconds; transient failures do not show a hard error banner. Successful completion resets the delay; another successful wake-up drain cancels the pending retry. A 4xx stops replay until the failed change is discarded. A 30-second drain deadline aborts stalled work before allowing another run, and unmounting cancels requests and retry timers.

- Offline data belongs to the signed-in user. Cached reads are stored per user id and queued changes carry the id of the user who made them, so another account on the same device never sees or replays them; an explicit logout also wipes the read cache, while a merely expired session keeps it. Queued changes no longer store a token: the replay sends the token that is valid when it runs, so changes queued before a re-login still sync. A `401` during replay pauses the queue without discarding anything and signals the session expiry; it resumes after the same user signs in again, and another user's queue stays untouched until they return. A queued change that points at a temporary id whose creating change was discarded is not sent; the banner shows a translated message and the discard action. Temporary ids are replaced as whole path segments or whole values only (`temp-1` and `temp-10` resolve independently).

- After a replay the detail page swaps resolved temporary entries for the real ones at once (an offline add never shows twice), and a full reload drops queued entries whose change no longer exists. Results of a load that finishes after the user opened another list are ignored, and the stream counter reset after a token change no longer triggers an extra reload.

- Queued mutations replay in creation order. Accepted mutations are removed together with persisting their temporary-to-server ID mappings on remaining mutations in one IndexedDB transaction, so partial retries and reloads retain dependent URLs and payloads. An accepted response is also retained in memory while local acknowledgement is retried. As with any client-only retry, if a server applies a write but its response is lost, the client cannot guarantee exactly-once delivery without server-side idempotency support.

### Error handling, validation and logging

- **Error responses.** Every error response of the API is `{ "error": "<English message>", "code": "<stable code>" }` (for example `list.not_found`, `list.forbidden`, `auth.invalid_credentials`, `entry.limit_open`, `invite.email_mismatch`, `rate_limited`, `internal.error`). Routes and middleware pass an `ApiError(status, code, message)` to `next()` and the one error handler in `app.js` writes the response; codes must be listed in `backend/src/errors.js` (`ApiError` throws on an unknown code, and a test fails when a code is unused or an error is written outside the handler). Database errors caused by client input (`22P02`, `23505`, `23503`) and malformed JSON bodies get codes too (`request.invalid_value`, `conflict.duplicate`, `reference.not_found`, `request.invalid_json`). Routes contain no "is there a database" guards: an app created without a database receives a stand-in pool whose every use fails with one `internal.error`. The web app translates by code: `getErrorMessage(error, t)` in `frontend/src/api/errors.ts` shows `errors.<code>` from the DE/EN locale files and falls back to the server's English message for a code it does not know yet; a frontend test reads the backend catalogue and fails when a code has no German or English text, so adding a code means adding both texts. The OpenAPI `Error` schema documents the `code` field; API clients should match on `code`, not on the message. Unknown `/api` paths answer `404 request.not_found` and a request body over the size limit `413 request.too_large`, both as JSON. Registration while disabled now answers `404` with `auth.registration_disabled` instead of an empty body.

- Input validation and errors: list, entry and member ids in paths are validated as UUIDs and answer `404` ("not found") without touching the database; malformed invite tokens answer `400` and malformed API keys `401`. Database errors caused by client input are mapped instead of surfacing as `500`: `22P02` → `400`, `23505` → `409`, `23503` → `404`. Registration inserts the user, the optional invite membership and the verification token in one transaction, and resending a verification replaces the token in one transaction. Notification mails (invite, revoke, leave, verification, resend, password reset) are sent after the change is committed and in the background: an SMTP failure is logged but never turns a successful change into an error response.

- Logs never contain credentials: the backend request log records only method, path (query string removed, invite token replaced by `:token`) and remote address, redacts `Authorization`, `X-Api-Key` and `Cookie` headers, and the nginx access log uses a format without the query string and without the `Referer` header (browsers send the full URL of pages such as `/reset-password?token=…` there), and masks invite tokens in `/invite/<token>` and `/api/invites/<token>`.

### Localization and UI

- The protected React app uses a dark Endgame-themed shell with bottom navigation for Lists.

- The frontend has English and German localization infrastructure with browser language detection, persistent language preference storage, and a DE/EN switcher in the Info & Settings sheet.

- The overview home screen uses a branded header, neon list cards, owner and shared status chips, and a bottom-sheet flow for creating new lists.

## Icon Assignment

New and edited entries can be assigned icons locally in the browser without sending item text to an external AI service. Exact EN/DE matches resolve immediately from the curated Tabler, Lucide, and custom SVG icon catalogue, including enriched synonym, regional, brand-name, and compound-word matches for grocery, produce, household, clothing, and drugstore items. Dedicated food, produce, drugstore, and household entries such as tomatoes, onions, rice, frozen food, snacks, dairy staples, shampoo, mouthwash, cleaning supplies, and paper goods use specific registry icons instead of generic category fallbacks. Broader terms fall back to a local `transformers.js` similarity check that suggests from the same expanded icon set. The picker shows human-readable labels such as `Ice Cream 2` instead of raw registry keys. When an entry is edited, its stored icon stays selected until the text changes (the suggestion for the unchanged text no longer replaces a custom icon); after a text change the new suggestion is adopted, and an icon the user picked during the edit is never overwritten. `PATCH /api/lists/:id/entries/:entryId` treats the `icon` key as present-or-absent: omitting it keeps the icon, a string replaces it and `icon: null` removes it.

Hand-crafted custom icons live as SVG files in `frontend/src/assets/icons/custom/` and are imported with `*.svg?react` through `vite-plugin-svgr`. Wrap new SVG imports with `normalizeCustomIcon` in `frontend/src/data/customIcons.js`, export them with a `Custom` prefix, and register those exports in `ICON_REGISTRY` so they render with the same `size`, `stroke`/`strokeWidth`, and `color` props as Tabler and Lucide icons.

`VITE_ICON_SIMILARITY_THRESHOLD` controls how strict that semantic fallback is. Lower values suggest icons more aggressively, while higher values require a closer match before the worker returns an automatic suggestion.

The semantic matcher runs in an ES-module web worker so the ONNX runtime can initialise correctly in both development and production builds. If that worker crashes, the frontend recreates it on the next suggestion request instead of leaving the icon-loading spinner stuck indefinitely.

The icon model is fetched on first use instead of at app startup: opening the add/edit item sheet starts the download while you type. The first semantic suggestion may take longer and shows a loading indicator while the model loads and matching completes. Exact catalogue matches remain immediate and work offline; semantic suggestions need the model and runtime to have been downloaded and retained in the browser cache before offline use. If they are unavailable, you can still choose an icon manually.

**Precomputed icon embeddings.** The vectors of the roughly 200 icon database entries only depend on their label/tag text and the model, so they are computed once and shipped as `frontend/src/data/iconEmbeddings.bin` (little-endian Float32, 200 × 384 values, about 300 KB, emitted as a hashed asset next to the lazy icon worker and not part of the service worker precache) with `iconEmbeddings.meta.json` (model, dtype, dimensions, count and a SHA-256 of the embedded texts). The worker downloads the asset once, on first use of the add/edit sheet, and then runs exactly one model inference per suggestion (for the typed text) instead of about 200 before the first one. The model is loaded with `dtype: "q8"`, the same quantisation that produced the vectors. After changing `ICON_DB` (`frontend/src/data/iconDatabase.ts`) regenerate the asset with `npm run build:icon-embeddings --workspace frontend` (needs network access once to download the model); `src/data/iconEmbeddings.test.ts` fails with that command when the database and the asset diverge, and the worker rejects an asset whose size does not match the database.

**No bundled ONNX WASM.** onnxruntime-web used to add its 23.5 MB `ort-wasm-simd-threaded.asyncify.wasm` to `dist`. transformers.js sets `wasmPaths` to the version-pinned jsDelivr copy whenever it runs in a worker (the CSP already allows `cdn.jsdelivr.net`), so the bundled copy was never requested; the Vite plugin `endgame:drop-unused-ort-wasm` removes it from the build output (`dist` shrank from about 25 MB to 1.8 MB). If the CDN setup is ever replaced by self-hosted WASM, remove that plugin.

## AI Workflow

This project uses the persistent planner/implementer/reviewer workflow defined in `AGENTS.md`.
