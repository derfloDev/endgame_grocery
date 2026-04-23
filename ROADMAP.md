# ROADMAP

Goal: polish the app identity and deliver a production-ready single-image Docker deployment.

## Priority 1 — Logo integration

Objective: replace placeholder SVG icons with the real PNG logo and surface it in the README.

- `frontend/public/` contains `icon-192.png` and `icon-512.png` generated from `endgame_grocery_logo.png`.
- Old placeholder SVG icons are removed.
- `vite.config.js` PWA manifest entries point to the new PNG icons with `image/png` type.
- `frontend/index.html` gains a `<link rel="icon">` pointing at the 192-pixel PNG.
- `README.md` opens with the logo image rendered above the project headline.

## Priority 3 — CI/CD Pipeline (GitHub Actions)

Objective: automated lint, build, test, and E2E on every push and PR; Release Please on main
for changelog + GitHub Releases; Docker image published to GHCR on release.

- `.github/workflows/ci.yml` — runs on every push and every PR:
  - Job `lint-and-build`: `npm run lint` + `npm run build`
  - Job `unit-test`: `npm test`
  - Job `e2e` (needs both above): PostgreSQL service container, `.env` created from
    workflow env, `npm run migrate`, Playwright Chromium, `npm run e2e`; screenshots and
    videos uploaded as artefacts on failure
- `.github/workflows/release-please.yml` — runs on push to `main`:
  - Release Please action (release-type: node) creates/updates release PR with
    `CHANGELOG.md` bump and `package.json` version bump
  - On release created: build Docker image and push
    `ghcr.io/derfloDev/endgame-grocery:<version>` + `:latest` to GHCR
- `package.json` — add `"version": "0.1.0"` field (required by Release Please)
- `README.md` — CI badge + short CI/CD workflow description

## Priority 2 — Dockerize (single image, nginx + Node.js)

Objective: ship a single production Docker image that serves both the static frontend and the
Express backend, parameterised entirely through environment variables.

- Multi-stage `Dockerfile`: builder stage runs `vite build`; runtime stage combines nginx
  (static files + `/api` reverse proxy) and Node.js backend managed by supervisord.
- `docker/nginx.conf` — nginx server block: static SPA fallback + `/api/` proxy to port 4000,
  gzip enabled, long-lived cache headers for hashed assets.
- `docker/supervisord.conf` — starts nginx and the Node.js backend as supervised processes.
- `docker/entrypoint.sh` — runs database migrations then hands off to supervisord.
- `.dockerignore` — excludes `node_modules`, `.env`, `dist`, test artefacts.
- `docker-compose.example.yml` — full-stack example: app service (built from local Dockerfile)
  + postgres service with health check; all required env vars documented inline.
- `backend/src/env.js` — load `.env` only when the file is present (local dev); rely on
  `process.env` when it is absent (Docker/CI).
- `README.md` — new "Docker Deployment" section documents the example compose file, available
  environment variables, and how to run migrations manually if needed.
