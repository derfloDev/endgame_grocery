# REVIEW

---

## T-001 — Project Scaffold

**Verdict: PASS_WITH_NOTES**

### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | minor | `backend/src/middleware/auth.js:3` | Stub `requireAuth` calls both `res.status(501).json(…)` and `next()`. Calling `next()` after a response is already sent will trigger a "headers already sent" error the moment any route applies this middleware. The `next()` call must be removed (or guarded) before T-003 wires auth middleware to any route. | Yes — fix in T-003 before middleware is applied to routes |
| 2 | nit | `backend/src/app.js:17-18` | Stub routes are mounted at `/api/entries` and `/api/sharing`. The plan specifies these as nested under `/api/lists` (`/api/lists/:id/entries`, `/api/lists/:id/members`). Stubs return 501 today so there is no functional impact, but the mount paths do not match the final API surface. T-004/T-005/T-006 implementers should update (or remove) these mounts. | No — cosmetic, addressed during feature tasks |

### Required Fixes

1. **(minor, T-003 pre-condition)** Remove or guard the `next()` call in `backend/src/middleware/auth.js` so the stub does not attempt to forward after sending a response.

### Verification

#### Steps performed
1. Read `.ai/PLAN.md` Phase 1 scope and acceptance criteria.
2. Inspected all delivered files: `package.json` (root, frontend, backend), `docker-compose.yml`, `.env.example`, `eslint.config.js`, `.prettierrc.json`, `vite.config.js`, `frontend/src/`, `backend/src/` (index, app, env, db/client, routes/*, middleware/auth).
3. Ran `npm run lint` — clean exit, no warnings.
4. Ran `npm run build` — Vite frontend build succeeded (30 modules); backend `node --check` syntax check passed.
5. Ran `npm test` — frontend Vitest (1 test, pass); backend `node --test` (1 test, pass).

#### Findings
- All T-001 acceptance criteria are satisfied:
  - npm workspaces (`frontend`, `backend`) correctly declared at root.
  - Root scripts `dev`, `build`, `lint`, `test` all present and functional.
  - `docker-compose.yml`: `postgres:16`, named volume `postgres_data`, correct env vars.
  - `.env.example` contains `DATABASE_URL`, `JWT_SECRET`, `PORT`.
  - `vite-plugin-pwa` listed as a frontend devDependency (configuration intentionally deferred to T-007 per plan).
  - Backend dependencies: Express, pg, dotenv, bcrypt, jsonwebtoken, nodemon — all present.
  - All stub routes return `501 Not Implemented` cleanly.
- The `requireAuth` middleware stub has a logic error (finding #1 above) that is safe today but will cause a runtime fault the moment T-003 attaches it to any route.

#### Risks
- **Low**: The auth middleware bug (finding #1) is latent. It will surface immediately when T-003 applies `requireAuth` to any route, but it will not affect any other task before that point.
- **Low**: Stub route mount paths (finding #2) differ from the final API spec. No functional risk until feature tasks reuse or extend these mounts.
