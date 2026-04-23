# Plan

Status: **ready_for_implement**

Goal: deliver T-001 (logo) and T-002 (dockerize) for the `chore/dockerize` branch.

---

## T-001 — Logo integration

### Scope
Replace placeholder SVG icons with real PNG icons derived from `endgame_grocery_logo.png`
and surface the logo in `README.md`.

### Acceptance Criteria
1. `frontend/public/icon-192.png` exists and is exactly 192 × 192 px.
2. `frontend/public/icon-512.png` exists and is exactly 512 × 512 px.
3. `frontend/public/icon-192.svg` and `icon-512.svg` are deleted.
4. `vite.config.js` — `includeAssets` and `icons` array reference only PNG files with
   `type: "image/png"` and `purpose: "any maskable"`.
5. `frontend/index.html` — `<head>` contains
   `<link rel="icon" type="image/png" href="/icon-192.png" />`.
6. `README.md` — first content is a centred `<img>` tag pointing at `endgame_grocery_logo.png`.
7. `npm run lint` passes.
8. `npm run build` passes.

### Implementation steps

**Step 1 — Generate PNGs**

Use the Node.js `sharp` package (install as a one-off dev tool in the workspace root, then
uninstall, or use an npx invocation) to resize `endgame_grocery_logo.png`:

```bash
npx sharp-cli --input endgame_grocery_logo.png --output frontend/public/icon-192.png resize 192 192
npx sharp-cli --input endgame_grocery_logo.png --output frontend/public/icon-512.png resize 512 512
```

Alternatively, if `sharp-cli` is unavailable, use the following inline Node.js script:

```js
// scripts/generate-icons.mjs
import sharp from "sharp";
await sharp("endgame_grocery_logo.png").resize(192, 192).toFile("frontend/public/icon-192.png");
await sharp("endgame_grocery_logo.png").resize(512, 512).toFile("frontend/public/icon-512.png");
```

Install `sharp` as a temporary dev dependency, run the script, then uninstall it again — or
keep it permanently in the root `devDependencies` for future icon regeneration.

**Step 2 — Remove old SVGs**

```bash
git rm frontend/public/icon-192.svg frontend/public/icon-512.svg
```

**Step 3 — Update `frontend/vite.config.js`**

```diff
-      includeAssets: ["icon-192.svg", "icon-512.svg"],
+      includeAssets: ["icon-192.png", "icon-512.png"],
       ...
         icons: [
-          { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
-          { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" }
+          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
+          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
         ]
```

**Step 4 — Update `frontend/index.html`**

Add inside `<head>`:
```html
<link rel="icon" type="image/png" href="/icon-192.png" />
```

**Step 5 — Update `README.md`**

Prepend before the `# endgame_grocery` heading:
```markdown
<p align="center">
  <img src="endgame_grocery_logo.png" alt="Endgame Grocery" width="180" />
</p>
```

### Files changed
`frontend/public/icon-192.png` (new), `frontend/public/icon-512.png` (new),
`frontend/public/icon-192.svg` (deleted), `frontend/public/icon-512.svg` (deleted),
`frontend/vite.config.js`, `frontend/index.html`, `README.md`

---

## T-002 — Dockerize (nginx + Node.js, single image)

### Architecture

```
Browser → :80 (nginx)
              ├── /api/*  →  proxy_pass http://127.0.0.1:4000  (Node.js / Express)
              └── /*      →  static SPA files from /usr/share/nginx/html
```

supervisord runs both nginx and the Node.js backend inside the same container.
The entrypoint script runs database migrations before handing control to supervisord.

### Acceptance Criteria
1. `Dockerfile` at repo root builds successfully with `docker build -t endgame-grocery .`.
2. Running `docker compose -f docker-compose.example.yml up` starts the app and postgres;
   the app is reachable on `http://localhost:80`.
3. `/api/health` returns `{"status":"ok"}` through nginx.
4. The React SPA loads and all deep-link routes return the `index.html` (SPA fallback).
5. All required env vars (`DATABASE_URL`, `JWT_SECRET`, `PORT`, `JWT_EXPIRES_IN`) are
   documented in `docker-compose.example.yml` with safe placeholder values.
6. `backend/src/env.js` loads `.env` only when the file is present; no error when it is absent.
7. `npm run lint` passes.
8. `npm run build` passes.

### Implementation steps

**Step 1 — `backend/src/env.js` — conditional `.env` load**

```diff
+import { existsSync } from "node:fs";

-// Resolve the workspace root `.env` from this module so backend scripts do not depend on process.cwd().
-dotenv.config({ path: envFilePath });
+// Load .env only in local dev (file is absent in Docker; env vars are injected by the runtime).
+if (existsSync(envFilePath)) {
+  dotenv.config({ path: envFilePath });
+}
```

**Step 2 — `.dockerignore`**

Create `.dockerignore` at repo root:
```
node_modules
**/node_modules
.env
frontend/dist
backend/dist
test-results
.ai
e2e
*.md
.git
```

**Step 3 — `docker/nginx.conf`**

```nginx
gzip on;
gzip_types text/plain text/css application/javascript application/json image/svg+xml;

server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # Long-lived cache for Vite-hashed assets
    location ~* \.(js|css|png|jpg|svg|ico|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Reverse proxy for the Express API
    location /api/ {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # SPA fallback — all unknown paths return index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Step 4 — `docker/supervisord.conf`**

```ini
[supervisord]
nodaemon=true
logfile=/dev/null
logfile_maxbytes=0

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
priority=10

[program:backend]
command=node /app/backend/src/index.js
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
priority=20
```

**Step 5 — `docker/entrypoint.sh`**

```bash
#!/bin/sh
set -e

echo "Running database migrations…"
node /app/node_modules/node-pg-migrate/bin/node-pg-migrate.mjs up \
  --migrations-dir /app/backend/src/db/migrations

echo "Starting services…"
exec supervisord -c /etc/supervisord.conf
```

**Step 6 — `Dockerfile`**

```dockerfile
# ── Stage 1: build frontend ──────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install all dependencies (workspaces)
COPY package*.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json  ./backend/
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build --workspace frontend


# ── Stage 2: production runtime ──────────────────────────────────────────────
FROM node:22-alpine AS runtime

# Install nginx and supervisord
RUN apk add --no-cache nginx supervisor

WORKDIR /app

# Install production dependencies only (backend + shared)
COPY package*.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json  ./backend/
RUN npm ci --omit=dev

# Copy backend source
COPY backend/src ./backend/src

# Copy built SPA
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy Docker config
COPY docker/nginx.conf      /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh   /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
```

> **Note on nginx config on Alpine**: Alpine's nginx uses `/etc/nginx/http.d/` for server
> blocks (not `/etc/nginx/conf.d/`). Verify the exact path during implementation with
> `nginx -T` inside the container if the build fails.

**Step 7 — `docker-compose.example.yml`**

```yaml
# Example full-stack deployment.
# Copy to docker-compose.yml and replace all "change-me" values before use.
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: endgame-grocery:latest
    ports:
      - "80:80"
    environment:
      DATABASE_URL: postgres://postgres:change-me@postgres:5432/endgame_grocery
      JWT_SECRET: change-me-strong-random-value
      PORT: 4000
      JWT_EXPIRES_IN: 7d
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: endgame_grocery
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: change-me
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

**Step 8 — `README.md` — Docker Deployment section**

Add a new `## Docker Deployment` section after the existing `## Local Development Setup`
section with:
- Prerequisites (Docker Engine / Desktop)
- How to use `docker-compose.example.yml`
- Environment variable reference table (`DATABASE_URL`, `JWT_SECRET`, `PORT`, `JWT_EXPIRES_IN`)
- Note that migrations run automatically on container startup
- Note that the existing `docker-compose.yml` is kept for local dev (postgres only)

### Files changed
`Dockerfile` (new), `.dockerignore` (new), `docker/nginx.conf` (new),
`docker/supervisord.conf` (new), `docker/entrypoint.sh` (new),
`docker-compose.example.yml` (new), `backend/src/env.js`,
`README.md`

---

## Validation (both tasks)

```
npm run lint
npm run build
```
