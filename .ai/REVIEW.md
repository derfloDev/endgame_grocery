# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001 — Logo PNG integration

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-23

#### Findings
No issues found. All acceptance criteria met exactly as specified in the plan.

#### Verification
##### Steps
1. Ran `git diff HEAD` to inspect all working-tree changes against plan criteria.
2. Verified `frontend/public/icon-192.png` and `frontend/public/icon-512.png` exist; confirmed dimensions with Node PNG header read (bytes 16–23 big-endian).
3. Confirmed `frontend/public/icon-192.svg` and `frontend/public/icon-512.svg` are deleted (git status shows `D`).
4. Confirmed `frontend/vite.config.js` `includeAssets` and `icons` array updated to PNG with `type: "image/png"` and `purpose: "any maskable"`.
5. Confirmed `frontend/index.html` has `<link rel="icon" type="image/png" href="/icon-192.png" />` inside `<head>`.
6. Confirmed `README.md` first content is `<p align="center"><img src="endgame_grocery_logo.png" …></p>`.
7. Ran `npm run lint` — PASS (1 pre-existing warning in AuthContext.jsx, 0 errors).
8. Ran `npm run build` — PASS, PWA precache 9 entries generated successfully.
##### Findings
- None. All 8 acceptance criteria verified.
##### Risks
- None. Changes are purely additive (new assets) and cosmetic (config, HTML, README).

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-002 — Dockerize (nginx + Node.js, single image)

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-04-23

#### Findings

- **nit** — `docker/nginx.conf`: `gzip on;` is placed at the top of a file included inside nginx's `http {}` block. This is valid (http-context directive), but could be confusing to readers who expect `gzip` in a dedicated `gzip.conf`. No functional issue.
- **nit** — `.dockerignore`: `*.md` at the repo root excludes README.md from the build context. This is intentional and correct for Docker, but also excludes CLAUDE.md/AGENTS.md if any future build step ever needed them. No functional issue for current scope.

#### Verification
##### Steps
1. Inspected all new files: `Dockerfile`, `.dockerignore`, `docker/nginx.conf`, `docker/supervisord.conf`, `docker/entrypoint.sh`, `docker-compose.example.yml`.
2. Verified `Dockerfile` is a correct two-stage build: builder stage builds the SPA, runtime stage installs prod deps only and assembles the final image.
3. Verified nginx config copies to `/etc/nginx/http.d/default.conf` (correct path for Alpine nginx).
4. Confirmed `node-pg-migrate` is in `backend/package.json` `dependencies` (production), so it will be present after `npm ci --omit=dev`.
5. Verified migration directory `backend/src/db/migrations/` is included in `COPY backend/src ./backend/src`.
6. Verified `/api/health` endpoint exists in `backend/src/app.js` and returns `{ status: "ok" }`.
7. Verified nginx `proxy_pass http://127.0.0.1:4000` for `/api/`, `try_files` SPA fallback, `gzip on`, and `listen 80`.
8. Verified `supervisord.conf` redirects both nginx and backend stdout/stderr to container fd 1/2.
9. Verified `entrypoint.sh` runs migrations then `exec supervisord` (clean signal propagation).
10. Verified `docker-compose.example.yml` contains all 4 required env vars with `change-me` placeholders, postgres healthcheck, and named volume.
11. Verified `backend/src/env.js` conditional `.env` load with `existsSync`.
12. Ran `npm run lint` — PASS (1 pre-existing warning, 0 errors).
13. Ran `npm run build` — PASS.
14. Ran `npm test` — PASS (25/25 tests, including 3 new `getConfig` tests for the `env.js` conditional load).
##### Findings
- AC1–4 (Docker build and runtime) verified by static analysis only; live `docker build` / `docker compose up` checks skipped because Docker CLI is unavailable in this environment. All artifacts are structurally correct.
- All other ACs (env vars, env.js conditional load, lint, build, tests) verified and passing.
##### Risks
- Low: The `DATABASE_URL` env var is implicitly read by `node-pg-migrate` from the environment. If `DATABASE_URL` is not set, migrations will fail at container startup. This matches the expected Docker/Compose configuration and is documented. No change required.
- Low: Live Docker runtime verification is deferred to first deployment. A `docker build` smoke test is recommended before merging to main.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`
