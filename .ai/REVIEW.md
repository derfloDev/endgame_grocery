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

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-30

#### Findings

- **nit** — `backend/src/index.js`: the diff also changes `createApp({ logger })` → `createApp({ logger, config })`, passing the already-computed config to `createApp` (which previously called `getConfig()` internally). Not a plan requirement, but it's a clean consistency improvement with no behaviour change in production. No fix required.
- **nit** — `backend/src/index.test.js`: the second new test ("prints the app version from the root package in the container entrypoint") validates `entrypoint.sh` content via regex instead of execution — appropriate as a unit test, though it only verifies presence of the pattern, not correctness of the shell script at runtime. Acceptable; Docker integration test would be needed for full coverage. No fix required.

#### Verification

##### Steps
1. Read all changed files (`backend/src/index.js`, `backend/src/index.test.js`, `docker/entrypoint.sh`, `README.md`) against the plan spec.
2. Confirmed `docker/entrypoint.sh`: version echo added immediately before migration step, reads from `/app/package.json` via `node -p`.
3. Confirmed `backend/src/index.js`: `readFileSync` reads root `package.json` at module load time; `version` field included in `logger.info` startup log object.
4. Confirmed `backend/src/index.test.js`: existing "logs backend startup details" test updated to assert `version: packageJson.version`; new "prints the app version from the root package in the container entrypoint" test added.
5. Confirmed `README.md`: sentence added in the Docker section stating version is logged twice on container start.
6. Ran `npm run lint` — 0 errors, 1 pre-existing warning in `AuthContext.jsx`.
7. Ran `npm run build` — clean build.
8. Ran `npm test --workspaces --if-present` — 120 frontend + 102 backend tests, 0 failures. Both T-002 test cases (`startServer` suite) pass.

##### Findings
- All acceptance criteria met.
- Path `../../package.json` relative to `backend/src/` resolves to the workspace root — correct for the Docker container where root `package.json` is at `/app/package.json`.

##### Risks
- None. Version string is emitted to container logs only; no user-facing or security impact.

#### Open Questions
- None.

#### Verdict
`PASS`
