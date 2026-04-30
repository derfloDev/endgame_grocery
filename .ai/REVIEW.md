# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-30

#### Findings

- **nit** — `backend/src/routes/auth.js` line 33: guard uses `config.registrationEnabled === false` (strict equality) rather than `!config.registrationEnabled`. Not a bug — the value is always boolean from `getConfig()` and tests inject `{ registrationEnabled: false }` — but reads slightly less idiomatically. No fix required.
- **nit** — `frontend/src/context/AppConfigContext.jsx`: exports `StaticAppConfigProvider` which was not listed in the plan. The addition is well-motivated (test utility) and does not affect production behaviour. No fix required.

#### Verification

##### Steps
1. Read all changed files against the plan specification.
2. Ran `npm run lint` — 0 errors, 1 pre-existing warning in `AuthContext.jsx` (unrelated to T-001).
3. Ran `npm run build` — clean build, no errors.
4. Ran `npm test` (backend node:test runner) — 102 tests, 0 failures.
5. Ran `npm run test --workspaces --if-present` (frontend vitest with `--environment jsdom`) — 120 tests, 0 failures.
   - Note: running `npx vitest run` directly (without `--environment jsdom`) triggers pre-existing `document is not defined` failures across the whole suite; this is a workspace-level environment quirk unrelated to T-001.
6. Verified acceptance criteria:
   - `POST /api/auth/register` returns 404 when `registrationEnabled: false` — covered by `auth.test.js` (new test).
   - `GET /api/config` returns `{ registrationEnabled: false }` — covered by `app.test.js` (new tests).
   - `/register` route redirects to `/login` when disabled — covered by `app.test.jsx`.
   - "Create an account" link hidden when disabled — covered by `app.test.jsx`.
7. Confirmed `AppConfigProvider` is placed outside `AuthProvider` in `main.jsx` (no auth required for public config endpoint).
8. Confirmed fail-open default (`registrationEnabled: true`) is preserved on fetch error.
9. Confirmed `Dockerfile` and `README.md` updated with `REGISTRATION_ENABLED` documentation.

##### Findings
- All acceptance criteria met.
- Pre-existing frontend test environment issue (missing `--environment jsdom` when running vitest directly) is not caused by this task.

##### Risks
- None. The `/api/config` endpoint is unauthenticated and leaks only the `registrationEnabled` flag — no sensitive data.

#### Open Questions
- None.

#### Verdict
`PASS`
