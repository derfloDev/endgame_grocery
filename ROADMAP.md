# ROADMAP

Goal: restore production container startup after the nginx configuration regression and detect
equivalent configuration failures before publishing an image.

Planning updated: 2026-10-12T04:37:26Z. The user invoked `start_plan` and selected approach 1.

## Priority 1 — Fix nginx startup

Objective: eliminate the duplicate `gzip_vary` directive while retaining the current compression,
cache headers, security headers, credential-safe logging and API proxy behaviour.

### Verified findings

- The reported production log shows nginx exiting with `"gzip_vary" directive is duplicate in
  /etc/nginx/http.d/default.conf:2`; supervisord repeatedly restarts nginx.
- `Dockerfile` installs Alpine's nginx package and copies `docker/nginx.conf` into
  `/etc/nginx/http.d/default.conf`, retaining the package's main configuration.
- Alpine's main configuration declares `gzip_vary on` inside `http` and includes `http.d/*.conf`
  within that same block. Our snippet declares it again at its top level. Includes do not create
  a new configuration scope, so the declarations collide.
- Commit `31d4c1d` (2026-10-09) introduced our `gzip_vary on` declaration alongside compression
  level 5 and the caching changes.
- `backend/src/nginxCaching.test.js` checks configuration text only; it never loads Alpine's main
  configuration. PR CI does not build or start the production image. The release image build
  currently does not run `nginx -t`.
- Docker CLI is installed locally, but no Docker daemon was reachable during analysis. The exact
  deployed image has not been inspected and no container reproduction has been run.

Sources: [Alpine nginx configuration](https://raw.githubusercontent.com/alpinelinux/aports/3.22-stable/main/nginx/nginx.conf)
and [nginx gzip directive contexts](https://nginx.org/en/docs/http/ngx_http_gzip_module.html).

### Approved decision — 2026-10-12

- Move all application gzip directives into the existing `server` block. This keeps
  the desired values explicit in a separate scope from Alpine's HTTP defaults. `map` and
  `log_format` declarations must remain at HTTP scope.

### Acceptance criteria

- The production image passes `nginx -t` using its complete installed configuration.
- An invalid nginx configuration fails the image build before publication.
- A PR CI smoke check builds the production image, starts its nginx process and verifies HTTP
  responses. The check must use the installed package configuration, not an isolated text fixture;
  an nginx-only check must be explicitly distinguished from a full application startup test.
- A compressible response requested with `Accept-Encoding: gzip` has gzip encoding and
  `Vary: Accept-Encoding`; the intended compression level remains 5.
- App shell, service worker, hashed assets and SPA fallback retain their documented cache policy
  and security headers. Existing logging and proxy checks continue to pass.
- Regression coverage is added before implementation, including evidence that the old
  configuration fails the real nginx validation and the fixed configuration passes.
- Required validation: `npm run lint`, `npm run build`, `npm test`, plus the real image checks.
  Record unavailable checks explicitly rather than treating text assertions as container evidence.

### Documentation scope

- Update `README.md` to explain configuration scope, the build-time nginx check, how to run the
  container smoke check and what it verifies. Correct the existing text-only validation description.
- Update comments in `docker/nginx.conf` and affected nginx tests to explain the scope decision
  and distinguish unit checks from real image validation.

No application feature changes, database changes or supervisor lifecycle redesign are proposed.
