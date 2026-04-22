# Plan

Status: **ready_for_implement**

Goal: Add Playwright E2E tests for the registration and login flows that exercise the complete stack — real browser, real Vite dev server, real Express backend, real PostgreSQL database.

## Context

- Frontend: Vite dev server on port 5173, proxies `/api` → `http://localhost:4000`
- Backend: Express on port 4000, health endpoint at `/api/health`
- Database: PostgreSQL via `DATABASE_URL` (root `.env`)
- Existing unit/integration tests use mocked fetch (frontend) and mocked DB pool (backend); they do not cover the real stack end-to-end.

## Scope

- Add `@playwright/test` as a dev dependency at the workspace root.
- Add `playwright.config.js` at the project root that:
  - configures two `webServer` entries (backend and frontend) so Playwright starts and waits for both before running tests;
  - sets `reuseExistingServer: !process.env.CI` so local dev servers are reused when already running;
  - targets `http://localhost:5173` as `baseURL`.
- Add `e2e/auth.spec.js` with the test scenarios listed below.
- Add an `"e2e"` npm script to root `package.json`.
- Update `README.md` to document the E2E setup and how to run the tests.

No new backend code is required. No test-specific API routes.

## Test data strategy

Each test run generates a unique email using `Date.now()` (e.g. `user_1714000000000@e2e.test`). This avoids conflicts between runs without requiring any DB cleanup logic. The test DB accumulates a small number of rows over time, which is acceptable for a dev environment.

## Test scenarios — `e2e/auth.spec.js`

### Registration

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| R-1 | Happy path — register new user | Navigate to `/register`, fill Display name / Email / Password, click "Create account" | Redirected to `/` (overview), "No lists yet." text visible |
| R-2 | Duplicate email | Register once (happy path), navigate to `/register` again with the same email | Error banner "An account with that email already exists." visible on page |

### Login

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| L-1 | Happy path — login with valid credentials | Register first (via API), navigate to `/login`, fill Email / Password, click "Log in" | Redirected to `/` (overview) |
| L-2 | Wrong password | Navigate to `/login`, submit valid email + wrong password | Error banner "Invalid email or password." visible |
| L-3 | Unknown email | Navigate to `/login`, submit unknown email + any password | Error banner "Invalid email or password." visible |

For L-1 the `request` context from Playwright is used to `POST /api/auth/register` as a setup step, so the test does not depend on browser-driven registration.

## Implementation phases

### Phase 1 — Install Playwright

**File**: `package.json` (root)

Add to `devDependencies`:
```json
"@playwright/test": "^1.44.0"
```

Add to `scripts`:
```json
"e2e": "playwright test"
```

### Phase 2 — Playwright configuration

**File**: `playwright.config.js` (new, project root)

```js
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: "npm run dev --workspace backend",
      url: "http://localhost:4000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    },
    {
      command: "npm run dev --workspace frontend",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    }
  ]
});
```

### Phase 3 — E2E test file

**File**: `e2e/auth.spec.js` (new)

Implement the five scenarios from the table above. Use `test.describe` blocks to group registration and login tests. Use a `uniqueEmail()` helper (timestamp-based) for test data isolation. For L-1, use `request.post` in `test.beforeAll` to pre-register the user via API.

### Phase 4 — Documentation

**File**: `README.md`

Add an "E2E tests" section documenting:
- prerequisite: Postgres running and `.env` present
- install browsers once: `npx playwright install chromium`
- run: `npm run e2e`
- note on `reuseExistingServer` (can run against an already-running dev server)

## Files to change

| File | Change |
|------|--------|
| `package.json` (root) | Add `@playwright/test` devDependency, add `e2e` script |
| `playwright.config.js` | New file — Playwright config with two webServer entries |
| `e2e/auth.spec.js` | New file — 5 E2E scenarios for register and login |
| `README.md` | Add E2E tests section |

## Validation

- `npm run lint`
- `npm run build`
- `npm run e2e` (requires running Postgres and `.env`)
