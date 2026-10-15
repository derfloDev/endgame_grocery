# Setup

This guide covers installing, configuring, running and operating an Endgame Grocery deployment: Docker, environment variables, push notifications, the production nginx behavior, Cloudflare and reverse-proxy settings, and security hardening. To work on the code instead, see [Development](DEVELOPMENT.md). Back to the [README](../README.md).

## Contents

- [Requirements](#requirements)
- [Docker Deployment](#docker-deployment)
- [Push notifications](#push-notifications)
- [Verify the installation](#verify-the-installation)
- [Production nginx behavior](#production-nginx-behavior)
- [Cloudflare and reverse proxy](#cloudflare-and-reverse-proxy)
- [Security hardening](#security-hardening)

Environment variables are listed in the [Environment variables](#environment-variables) table; the template file is [`.env.example`](../.env.example) and the example Compose file is [`docker-compose.example.yml`](../docker-compose.example.yml).

## Requirements

- Docker Desktop or Docker Engine with Docker Compose support

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

The published image is multi-arch for `linux/amd64` and `linux/arm64`, and Docker pulls the matching variant automatically. A Raspberry Pi 3/4/5 needs a 64-bit OS (for example 64-bit Raspberry Pi OS); 32-bit ARM (`linux/arm/v7`) is not supported. Multi-arch images start with the first release after this change, so older tags are amd64-only.

Run exactly one app container: the push worker and the live-update (SSE) fan-out live inside the backend process, so scaling the service to several replicas would split live updates between them and run several push workers.

Container startup logs also print the app version twice: once from `docker/entrypoint.sh` before migrations and once in the backend JSON startup log entry.

The repository's checked-in `docker-compose.yml` is intentionally kept for local development and starts PostgreSQL only.

### Environment variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by migrations and the backend. | `postgres://postgres:change-me@postgres:5432/endgame_grocery` |
| `PG_POOL_MAX` | Maximum number of pooled PostgreSQL connections per backend instance. Requests wait at most 5 s for a free connection and idle connections close after 30 s. Keep it below the server's `max_connections`. Optional, default `10`. | `10` |
| `JWT_SECRET` | Secret used to sign authentication tokens (HS256 only). Required: at least 32 characters and no `change-me` placeholder, otherwise the backend refuses to start. Generate with `openssl rand -base64 48`. | `replace-with-openssl-rand-base64-48-output` |
| `ENABLE_TEST_ROUTES` | Set to `true` to mount `POST /api/test/create-verified-user` for E2E setup. Off by default; never enable it on a reachable deployment. | `false` |
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

## Push notifications

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
- Push subscriptions are only accepted for `https` endpoints of the browser push services (`fcm.googleapis.com`, `push.services.mozilla.com`, `notify.windows.com`, `push.apple.com`, `web.push.apple.com` and their subdomains); other URLs and IP literals are rejected with `400`, because the backend sends a request to every stored endpoint.
- A push subscription whose push service answers `404` or `410` is deleted. Any other delivery error is logged as a warning for that subscription only and does not stop delivery to the others.
- The push worker runs inside the backend process and the SSE fan-out is in-memory, so run **one backend instance**. Jobs are enqueued and claimed with single SQL statements (`INSERT … ON CONFLICT`, `DELETE … FOR UPDATE SKIP LOCKED`), so entries added at the same moment are merged into one notification and a job is never sent twice by overlapping ticks.
- Push delivery logs include job enqueue/fire events, recipient and subscription counts, sent counts, and expired subscription cleanup so production notification issues can be traced from the backend logs.

### PWA notification opt-in and diagnosis

Push opt-in needs HTTPS (loopback is allowed for local tests), `Notification`, `PushManager`,
an active service worker and the backend VAPID configuration described above. Shared lists
show the notification action once configuration loading settles. Configuration loading,
worker activation and a subscription attempt are separate states. Existing browser
subscriptions are restored without requesting permission.

The action requests permission only from a user click and prevents duplicate attempts while
pending. English and German feedback distinguishes configuration, blocked permission,
registration, installation, activation timeout and subscription/API failures. After a
recoverable failure is removed, choose **Enable notifications** again in the same page;
no reload or cache deletion is required. A worker attempt settles within eight seconds.
Blocked permission requires changing browser/device settings; the app does not prompt again
while permission is denied. An absent or temporarily unavailable VAPID key is fetched again
on the next attempt. Persistent access or network restrictions continue to show an error.

To diagnose the lifecycle, inspect Application > Service Workers and Network in browser
developer tools:

1. No registration: check whether `/service-worker.js` was requested and whether registration
   rejected. Inspect status, redirects, MIME type, scope and CSP (`worker-src`). An HTML/login
   response or blocked script is a registration failure, not slow activation.
2. Registration without an active worker: inspect `installing`, `waiting`, `active` and
   `redundant` states. Evaluation errors appear in the worker console. Installation/precache
   errors identify the failed asset request; inspect its response and access policy.
3. A worker stuck installing or waiting: inspect its state changes and install/activate
   promises. An activation timeout is feedback, not proof of the underlying cause.
4. Active worker but opt-in fails: inspect permission, VAPID configuration and the push
   subscription API request. Never share cookies, tokens or Access login query strings in logs.

## Verify the installation

The steps below describe the registration and verification flow. For a Docker deployment open `http://localhost:80/register` (see [Docker Deployment](#docker-deployment)); the `http://localhost:5173` address is the local development server described in [Development](DEVELOPMENT.md#local-development-setup).

### 8. Verify the setup

Open `http://localhost:5173/register` and create an account. If the environment file, database container, migrations, and SMTP settings are in place, the backend sends a verification email instead of logging you in immediately. Follow the `/verify-email` link from that message to activate the account and enter the protected grocery list UI. Shared-list invite mails use the same `APP_BASE_URL`: existing users land on `/invite/:token` and join after login, while new users can register through `/register?invite=...` and are added to the list immediately.

## Production nginx behavior

The production Nginx configuration in `docker/nginx.conf` keeps all four gzip directives inside `server`: Alpine already declares `gzip_vary on` in the enclosing HTTP scope, so declaring it there again prevents nginx startup. HTTP-only `map` and `log_format` remain outside `server`. It enables gzip (level 5, `Vary: Accept-Encoding`; text, JSON, web manifest, SVG and WASM types, but not the already compressed WOFF2 fonts) and sets one explicit `Cache-Control` header per kind of file:

| Location | `Cache-Control` | Why |
| --- | --- | --- |
| `/assets/*` | `public, max-age=31536000, immutable` | Vite content-hashes every file name, so a changed file has a new URL |
| `/service-worker.js`, `/index.html` and the SPA fallback | `no-cache` | Must be revalidated on every load so users never stay on an old shell or on chunk names that no longer exist |
| `/fonts/*`, `/icon-*.png`, `/manifest.webmanifest` | `public, max-age=86400` | File names are not hashed, so a change reaches users within a day |

Every one of these locations repeats the shared security headers (`docker/security-headers.conf`), because nginx does not inherit `add_header` into a location that sets its own; the `/api/` proxy sets none and keeps the server-level headers. `backend/src/nginxCaching.test.js` checks these rules against the configuration text (nginx itself is not started in the unit tests). The Dockerfile runs `nginx -t` after copying both configuration files, checking Alpine's complete installed configuration during CI and release image builds. CI also runs the production-image HTTP smoke check described below. The hashed assets are what lets the service-worker install reuse the browser's cached response for each asset already fetched by the page; the fonts and icons are no longer immutable, but their one-day lifetime serves the same reuse during a cold load. The hashed `/assets/*` files are what lets the service-worker install reuse the browser's cached response for each asset the page already fetched; fonts and icons are no longer immutable, but their one-day lifetime serves the same reuse during a cold load. An earlier model of the production cold load (427,883 bytes counting each path once, about 446 KiB with level 1 gzip) predates the startup bundle split described above and is superseded by the measurement given there; level 5 compression only lowers such figures. None of these numbers was measured against a running Nginx image.

> Reading note: in the paragraph above, "described below" refers to [Production nginx image smoke check](DEVELOPMENT.md#production-nginx-image-smoke-check) and "described above" refers to [Cold-load assets and offline precache](DEVELOPMENT.md#cold-load-assets-and-offline-precache), both in [Development](DEVELOPMENT.md).

## Cloudflare and reverse proxy

### Service-worker navigations and Access

Every app navigation, including a normal reload of `/` or a list route, tries the network
through Access first. Login redirects, 401/403 responses and Cloudflare challenges are shown
to the browser and never runtime-cached. After three seconds, a rejected fetch, or an origin
outage (5xx/52x), the worker falls back to the precached app shell; offline startup can take
up to three seconds. The reserved `__reconnect` query parameter disables that timeout so an
explicit reconnect can wait for Access; network rejection and origin errors still fall back.
The `/index.html` Access exception and Cache Rules below remain required for a valid,
revalidated offline shell. A login page never replaces that precached shell.

### Cloudflare Access: public PWA resources

The selected deployment policy makes the following static resources anonymously retrievable.
They expose the app shell, client code/translations, static media and install metadata; never
embed secrets or private list data in them. List/user data remains behind `/api/*` and application
authorization. Keep the hostname-wide Access application protecting all remaining application
routes. A repository/image deployment does **not** configure the Cloudflare account.

Use `grocery.example.com` as the reserved example throughout these instructions. Substitute
the actual hostname only in account settings or external diagnostics; do not record personal
deployment hostnames/URLs in repository files or evidence.

In Cloudflare Zero Trust, create a reusable Access policy with action **Bypass** and
**Include > Everyone**. Attach it to specific **Self-hosted** applications on the chosen
hostname for exactly these paths (separate paths can share that policy):

| Access application path on `grocery.example.com` | Public content and origin cache policy |
| --- | --- |
| `/service-worker.js` | Actual worker entry: JavaScript 200, no login redirect, scope `/`; edge bypass, browser revalidates with `no-cache` |
| `/index.html` | Precached app shell: HTML 200; edge bypass, browser `no-cache` |
| `/assets/*` | Generated content-hashed JS/CSS/media, including lazy assets; this entire prefix is public, retaining `public, max-age=31536000, immutable` for hashed files |
| `/fonts/*` | Self-hosted precache fonts; `public, max-age=86400` |
| `/icon-192.png` and `/icon-512.png` | Installation/notification icons (two exact paths); `public, max-age=86400` |
| `/manifest.webmanifest` | Install metadata and precache resource; `public, max-age=86400` |

More-specific application paths take precedence over the protected hostname application;
inspect overlapping applications so the static policy applies to the intended paths. Do not
attach the public policy to the hostname/root or add an `/api/*` exception. The current
production build's precache URLs fit this table, and Workbox is bundled in the worker: no
speculative `/workbox-*.js` exception is needed. Inspect every build's worker imports and
manifest entries; a future resource outside this table needs an explicit policy review.
The manifest link's `crossorigin="use-credentials"` remains enabled, but its credentials do
not prove worker install requests succeed; the selected policy makes the manifest public.
See [Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
and [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/policy-management/).

### Cloudflare caching and stale-worker recovery

Access **Bypass** grants anonymous access. Cache **Bypass** controls edge storage. Configure
both separately. In the zone's **Caching > Cache Rules**, add a hostname/path-scoped rule:

```text
(http.host eq "grocery.example.com" and http.request.uri.path in {"/service-worker.js" "/index.html"})
```

Select **Cache eligibility: Bypass cache**. Separately ensure **Browser Cache TTL** respects
the origin's `no-cache` for worker/shell responses; where the matching rule exposes Browser
TTL, use **Respect origin**, and audit zone settings/other overrides as well. Edge bypass
alone does not establish correct browser headers. Inspect conflicting Cache Everything/Page
Rules, Edge TTL/status-code TTL, Browser TTL, response-header transformations and Cloudflare
Worker overrides. Preserve `no-cache` for SPA HTML/fallback responses and immutable caching
only for content-hashed assets; retain short origin lifetimes for fonts/icons/manifest.
Cloudflare edge TTL determines edge freshness, browser TTL determines browser HTTP-cache
freshness, and service-worker CacheStorage is a separate cache controlled by Workbox.
A single `MISS` is not proof of bypass; a bypass rule can report `DYNAMIC`. Verify repeated
normal-URL responses and the effective rules. See [Cache Rules settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/)
and [edge/browser TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/).

Incident evidence, 2026-10-12: initial anonymous probes encountered Access login redirects.
With authentication temporarily disabled, the normal worker was still a Cloudflare `HIT`
from 23 September with a one-year immutable lifetime. Its manifest referenced four removed
assets returning 404, including a translation chunk; the real worker became `redundant`
with Workbox `bad-precaching-response`. A unique diagnostic query returned a newer worker
whose 38 manifest entries (35 unique URLs) were available and whose installation activated.
That newer response still had a four-hour browser cache lifetime instead of intended
`no-cache`, so deployed origin/edge overrides require inspection. The user subsequently
purged the Cloudflare cache and reported Android notification opt-in recovery. This measured
stale-worker failure differs from an Access redirect or connectivity failure. The query
was a diagnostic comparison, not a registration fix; the application keeps the normal URL.

After correcting rules, use **Caching > Configuration > Purge Cache > Custom Purge > URL**
to purge the normal worker URL, for example `https://grocery.example.com/service-worker.js`.
Purge only other cache keys demonstrated to be stale, accounting for custom cache keys when
present; dashboard URL purges cannot supply custom header/cookie keys, so use the existing
account API with the exact key fields when required. Keep credentials outside evidence. Do
not purge the whole zone or change zone-wide security settings. An edge purge
does not erase browser HTTP cache or service-worker CacheStorage. Subsequent deployments
should deliver the current normal worker without manual purges. See [single-file purge](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-single-file/).

### Verify the live PWA rollout

The local regression simulates stale responses; it does not apply or verify live rules.
Permanent cache rules, restored Access, authenticated installed-app updates, the next real
deployment without purging, and final Android/device delivery checks remain T-003 rollout
gates. The reported phone recovery did not supply a browser version, Brave result, reload
restoration, real delivery or click-navigation evidence.

Current rollout evidence at 2026-10-13T06:52:55Z:

| Check | Result and evidence source |
| --- | --- |
| Active Access/cache rules | Administrator reports the rules are active; independent repeated normal worker/shell GETs return `no-cache` / `DYNAMIC`, without Age |
| Public static resources | All 38 current precache requests / 35 unique paths return 200 with valid content; shell asset references are covered |
| Protected routes | Anonymous root/login/list and sampled API routes redirect to Access |
| Normal worker lifecycle | Clean Chromium 147.0.7727.15 diagnostic: `installing -> installed -> activating -> activated`, no failed HTTP responses |
| Installed Android Chrome | User confirms notification opt-in works under current Access settings and reports continued operation after deployment; Chrome version was not supplied |
| Subsequent deployment | User reports a regular redeployment without cache purge; independent post-report checks remain coherent, but worker hash and Last-Modified are unchanged and exact image version/digest is awaiting confirmation |
| Normal icon cache entries | Still unresolved: both normal icon URLs have old year-long immutable HIT headers; normal `/icon-192.png` contains old bytes, unlike the revision-query response and repository file, which match |

The October 12 baseline had worker `max-age=14400` / `REVALIDATED` and no established
Access protection. On October 13 the cache/protected-route responses improved, but the first
check found all 26 asset entries still Access-gated and a redundant worker. The corrected
asset exception subsequently passed and activation recovered. Detailed timestamped checks
remain in ROADMAP.md and .ai/HANDOFF.md.

Closing note at 2026-10-13T13:42:32Z: the administrator reports that all relevant edge entries,
including the two normal icon URLs, have been purged. This was not independently re-measured
by the agent in this session. The exact deployed image digest was not supplied; the redeployment
was reported as successful without purge and served identical worker content. Installed update/reload
restoration, real delivery/click navigation, the Android Chrome version and Brave results were not
reported and remain unverified; opt-in and desktop activation do not prove them. T-003 is closed
on the user's explicit instruction with these gaps recorded.

Use GET/body checks, not HEAD alone. For example, on Bash with curl, Python 3 and sha256sum:

```bash
pwa_check_dir=$(mktemp -d)
curl --silent --show-error --user-agent 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36' \
  --dump-header "$pwa_check_dir/headers" --output "$pwa_check_dir/worker.js" \
  --write-out 'HTTP %{http_code}\nMIME %{content_type}\n' \
  'https://grocery.example.com/service-worker.js'
python3 - "$pwa_check_dir/headers" <<'PYHEADERS'
import sys
from urllib.parse import urlsplit
safe = {"cache-control", "cf-cache-status", "age", "content-type", "last-modified"}
with open(sys.argv[1], encoding="iso-8859-1") as headers:
    for line in headers:
        name, separator, value = line.partition(":")
        if separator and name.lower() in safe:
            print(line.strip())
        elif separator and name.lower() == "location":
            target = urlsplit(value.strip())
            print("Redirect origin:", f"{target.scheme}://{target.netloc}" if target.netloc else "same origin")
PYHEADERS
sha256sum "$pwa_check_dir/worker.js"
```

The command deliberately does not follow redirects or print cookies, tokens or Access query
strings. Temporary raw headers stay outside repository artifacts; remove them when finished.
If a diagnostic client hits Cloudflare error 1010, compare a normal browser user agent and a
real browser before attributing that client rejection to worker installation.

Repeat the normal GET, compare worker content/hash with the deployed image/build, and check
`Cache-Control`, `CF-Cache-Status`, `Age`, status and MIME type. Fetch every manifest entry,
including its Workbox revision query when present, and inspect imports: all must return 200
with valid content rather than login HTML. Check the same static resources anonymously after
Access restoration; separately confirm that `/api/*` and other application routes remain
gated and API authorization still rejects unauthenticated access. In a clean real browser,
verify the normal worker activates with no failed precache requests. Then check installed
updates and the next real deployment without purging, followed by Android Chrome opt-in,
reload restoration, delivery from another member and click navigation; record browser/version
and Brave results or gaps separately. Do not treat desktop or stubbed push tests as delivery
proof. Vite preview also does not prove deployed Nginx headers: use the production-image smoke
check below and inspect the effective deployed image/configuration.

> Reading note: the "production-image smoke check below" is described in [Production nginx image smoke check](DEVELOPMENT.md#production-nginx-image-smoke-check) in [Development](DEVELOPMENT.md).

## Security hardening

- **Rate limits** (in memory, so they reset on restart and assume a single backend instance): `POST /api/auth/login` allows 5 *failed* attempts per 15 minutes per client IP and, separately, per email (successful logins are not counted); register, forgot-password and resend-verification allow 5 requests per hour per IP and per email; reset-password allows 10 per hour per IP; list invitations allow 20 per hour per user. Blocked requests get `429` with a `Retry-After` header (seconds). The limits are switched off when `ENABLE_TEST_ROUTES=true` (the Playwright E2E setup, which registers and fails logins from one IP); the production image never sets it.
- **Client IP:** the backend trusts exactly one proxy hop (`trust proxy` = 1), i.e. the nginx in the container, so the limits key on the address nginx saw. If you put another proxy or Cloudflare in front, nginx sees that proxy's address unless you add `set_real_ip_from` / `real_ip_header` to `docker/nginx.conf`; otherwise every visitor shares one counter.
- **Login timing:** an unknown email is compared against a dummy bcrypt hash, so the response time does not reveal which emails are registered.
- **Passwords** (registration and reset) must be strings of at least 8 characters and at most 72 UTF-8 bytes, because bcrypt ignores everything after 72 bytes. The server answers `400`; the register and reset forms check the same rule first and show a translated hint (DE/EN).
- **Login redirects:** after signing in, `?redirect=` and the router state are only followed when they are an in-app path (a single leading `/`, not `//…`, `/\…` or an absolute URL); anything else goes to `/`.
- **Security headers:** nginx sends `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `Permissions-Policy` on every response (`docker/security-headers.conf`, included at server level and in the static-asset location, because nginx does not inherit `add_header` into a location that sets its own). The CSP is `default-src 'self'` with these additions, each verified against the production build in Chromium (zero violations for the login page, list detail, the first icon-model download, the service worker/push opt-in and the Swagger UI at `/api/docs/`):

  | Directive | Extra sources | Why |
  | --- | --- | --- |
  | `script-src` | `'wasm-unsafe-eval'`, `blob:`, `https://cdn.jsdelivr.net` | ONNX runtime for the icon model: WebAssembly compilation, its loader module (imported through a `blob:` URL, which Chromium blocked without it) and the runtime files from jsDelivr |
  | `connect-src` | `https://huggingface.co`, `https://*.hf.co`, `https://cdn.jsdelivr.net` | Model download on first use of the semantic icon suggestion |
  | `worker-src` | `blob:` | Icon worker |
  | `img-src` | `data:`, `blob:` | Inline and generated images |
  | `style-src` | `'unsafe-inline'` | Inline styles set by the UI components (scripts stay free of inline code) |

  Add hosts only with a recorded violation; the policy is covered by `backend/src/containerHardening.test.js`.
- **Non-root backend:** supervisord starts the Node backend as the `node` user; only nginx runs as root (it binds port 80).
- **CI:** every workflow declares least-privilege `permissions` and all third-party actions are pinned to a full commit SHA (the tag is kept as a comment). Update the SHA and the comment together when bumping an action.
