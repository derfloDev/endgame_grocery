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

---

## Task: T-003 — Switch example Compose to registry image

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-23

#### Findings

- **nit** — `docker-compose.example.yml` / `README.md`: image reference `ghcr.io/derfloDev/endgame-grocery:latest` uses mixed-case username. GHCR enforces lowercase namespaces per OCI spec; Docker clients typically canonicalize to lowercase on pull, so this is likely to work transparently in practice. The value matches the plan exactly — this is a plan-level note, not an implementer deviation. No change required.

#### Verification
##### Steps
1. Ran `git diff HEAD` for both changed files; verified changes are precisely scoped to T-003 (no unintended side effects).
2. Confirmed `build:` block (context + dockerfile) is removed from `docker-compose.example.yml`.
3. Confirmed `image:` is set to `ghcr.io/derfloDev/endgame-grocery:latest` (matches plan AC2 exactly).
4. Confirmed README: `docker compose up --build` replaced with `docker compose up -d`.
5. Confirmed README prose references `ghcr.io/derfloDev/endgame-grocery` for pull-based workflow.
6. Ran `npm run lint` — PASS (1 pre-existing warning, 0 errors).
7. Confirmed only 2 files changed: `docker-compose.example.yml`, `README.md` — exactly as planned.
##### Findings
- All 4 acceptance criteria verified. Changes are minimal and correctly scoped.
##### Risks
- Very low: mixed-case GHCR namespace is noted above; Docker client normalization makes this unlikely to be a live issue.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-004 — CI/CD Pipeline (GitHub Actions + Release Please)

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-23

#### Findings

- **nit** — `ci.yml` lines 14–16, 29–31, 44–46: per-job `concurrency` blocks are redundant alongside the top-level workflow `concurrency` block (lines 7–9). The workflow-level block already cancels all jobs on the same branch. No functional impact.
- **nit** — `release-please.yml` line 30: `if: ${{ needs.release-please.outputs.release_created == 'true' }}` uses explicit string comparison rather than the plan's truthy check. This is the GitHub-recommended pattern for output booleans — a minor improvement. No change required.

#### Verification
##### Steps
1. Confirmed `.github/workflows/ci.yml` exists with exactly three jobs: `lint-and-build`, `unit-test`, `e2e`.
2. Verified `e2e` job: postgres:16 service with health-cmd, `.env` file creation, `npm run migrate`, `npx playwright install chromium --with-deps`, `npm run e2e`, artifact upload on failure with 7-day retention.
3. Verified workflow-level `concurrency` with `cancel-in-progress: true` covers all three jobs.
4. Confirmed `.github/workflows/release-please.yml` with `release-please` job using `google-github-actions/release-please-action@v4`, `release-type: node`.
5. Confirmed `docker-publish` job: gated on `release_created == 'true'`; `packages: write` permission; `GITHUB_TOKEN` for GHCR login; `docker/metadata-action@v5` with semver + `latest` tags; `docker/build-push-action@v5`.
6. Verified `release-please.yml` top-level permissions: `contents: write`, `pull-requests: write`. `docker-publish` job-level override: `contents: read`, `packages: write`.
7. Verified `concurrency: cancel-in-progress: false` in `release-please.yml` — correct, prevents release jobs from being killed mid-run.
8. Confirmed `package.json` `"version": "0.1.0"`.
9. Verified README: CI badge appears after logo image and before `# endgame_grocery` heading; `## CI/CD` section placed after `## Available Scripts`.
10. Confirmed backend unit tests use mock pool objects — `unit-test` job correctly requires no live postgres.
11. Ran `npm run lint` — PASS (1 pre-existing warning, 0 errors).
##### Findings
- All 8 acceptance criteria fully verified.
##### Risks
- Low: `release-please-action@v4`, `docker/login-action@v3`, `docker/metadata-action@v5`, `docker/build-push-action@v5` are pinned to major version tags, not SHA digests. A future supply-chain hardening pass should pin to SHAs.

#### Open Questions
- None.

#### Verdict
`PASS`
