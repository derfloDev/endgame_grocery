# Plan

Status: **ready_for_implement**

Updated: 2026-10-12T04:37:26Z. Owner role: `implement`.

Goal: restore nginx startup in the production container and catch invalid nginx configurations
before an image can be published.

## Decision and evidence

- The user selected approach 1: keep explicit gzip settings, scoped to the application's `server`.
- `Dockerfile` installs Alpine nginx and copies our snippet into `/etc/nginx/http.d/default.conf`.
  Alpine includes that file inside `http`, where it already declares `gzip_vary on`.
- Commit `31d4c1d` added our duplicate declaration at snippet line 2. The reported startup error
  names that exact directive and location. Supervisor's restart messages are a consequence.
- Existing nginx unit tests inspect our snippet in isolation. PR CI does not build the image;
  the release image build has no real nginx configuration validation.
- Analysis did not run the image: the local Docker daemon was unavailable. Implementation and
  review must obtain real image evidence locally or in CI and record any remaining limitation.

## T-001 — Restore nginx startup and verify the shipped configuration

Dependencies: none. One task keeps the fix, regression coverage and documentation in one commit.

### Files to change

- `docker/nginx.conf`: relocate gzip directives and explain Alpine HTTP defaults in a comment.
- `Dockerfile`: run the real nginx configuration check after copying every nginx configuration file;
  add a comment explaining why the image build validates the installed configuration.
- `backend/src/nginxCaching.test.js`: add scope regression coverage, retain compression/cache/header
  assertions and update the comment explaining the boundary between unit and image checks.
- `backend/src/containerHardening.test.js`: assert the Dockerfile retains the validation step after
  copying both the server snippet and security header include.
- New `docker/smoke-nginx.sh`: reusable Linux/Bash smoke check for a supplied local image tag,
  with comments documenting its nginx-only scope and cleanup behaviour.
- `.github/workflows/ci.yml`: add a production-image build and nginx smoke job for the existing
  pull-request and main-branch triggers, using the repository's pinned actions.
- `README.md`: update the production nginx/cold-load and validation sections with the configuration
  scope, build guard, exact smoke commands/prerequisites and the limits of this smoke test.
- `.ai/TASKS.md` and `.ai/HANDOFF.md`: normal implementation/review handoff updates.

### Tests first

1. Extend nginx unit coverage before changing production configuration. Assert `gzip on`,
   `gzip_vary on`, `gzip_comp_level 5` and the existing `gzip_types` are inside the `server` block,
   with no application gzip directives at HTTP scope. Parse/extract the relevant block rather
   than only relaxing the existing unindented regular expressions. Preserve all MIME, caching
   and security assertions; `map` and `log_format` must stay at HTTP scope.
2. Add the Dockerfile guard assertion and write the image smoke script before the implementation.
   Run targeted tests and record their expected failures on the original configuration.
3. Where Docker is available, build the original image before adding the build guard and run
   `docker run --rm --entrypoint nginx <image> -t`. Record the duplicate-directive failure.
   Use the original image's installed main configuration; do not substitute a standalone fixture.
   If Docker is unavailable locally, obtain this before/after evidence on a Docker-capable runner.

### Implementation

1. Move all four gzip directives and their compression comments into the existing `server` block.
   Keep their values and MIME list unchanged. Add a brief comment explaining that server scope
   avoids redefining directives in Alpine's enclosing HTTP scope. Leave HTTP-only maps and log
   formats outside `server`; retain locations, proxy settings and security header includes.
2. Add `RUN nginx -t` after the Dockerfile has copied both `docker/nginx.conf` and
   `docker/security-headers.conf` into their final destinations. Validate the default installed
   configuration, not a custom `-c` file. This guard runs in both CI and the existing release build;
   no release workflow change or database credentials are required.
3. Complete the smoke script with the following contract:
   - Accept an already-built image tag; fail with a clear English diagnostic if Docker or required
     host tools are unavailable. It runs on Linux with Bash, Docker and curl.
   - Run `nginx -t` in a disposable container from that image.
   - Start another container with the entrypoint overridden to `nginx -g 'daemon off;'`, publish
     port 80 on a dynamically allocated localhost port and discover the mapping through Docker.
     This intentionally bypasses migrations, supervisord and the backend; no database is needed.
   - Wait for HTTP readiness with bounded polling, check the container remains running and fail
     on unexpected exit. Print relevant logs on failure and always remove only its own container.
   - Request real built assets, discovering a hashed JS/CSS path from the served index rather than
     hard-coding a chunk name. Require success for `/index.html`, `/service-worker.js`, the hashed
     asset and a SPA route such as `/lists/smoke-test`; ensure the SPA response is the app shell.
   - Assert one Cache-Control header per response: `no-cache` for shell/service worker/SPA and
     `public, max-age=31536000, immutable` for the hashed asset. Verify all four configured security
     headers are present. Retain existing unit coverage for fonts, icons and manifest cache rules.
   - Request a sufficiently large real text asset with `Accept-Encoding: gzip`; require
     `Content-Encoding: gzip` and `Vary` containing `Accept-Encoding`. Verify the compressed body
     decompresses to the same bytes as an identity response. Unit coverage establishes level 5.
4. Add an independent `nginx-smoke` CI job using checkout, `docker build -t endgame-grocery:nginx-smoke .`
   and `bash docker/smoke-nginx.sh endgame-grocery:nginx-smoke`. It must run on PRs, fail on build
   or smoke errors, and never silently skip for missing Docker. It must not publish an image.
5. Update README and comments in the same task. Explain the original collision and server scope;
   document the commands above and the build-time guard. Distinguish nginx image validation from
   full application/DB startup and browser E2E. Replace the outdated implication that nginx is never
   tested, while retaining the accurate statement that unit tests themselves inspect text.

### Acceptance and verification

- Targeted regression tests fail before the fix and pass afterwards without weakening existing
  cache, MIME, security or logging assertions.
- All four gzip settings are server-scoped; HTTP-only directives remain valid at HTTP scope.
- `docker build -t endgame-grocery:nginx-smoke .` succeeds with the real `nginx -t` guard.
- Negative build check: temporarily restore the original conflicting snippet in an isolated build
  context and verify the guarded image build fails at `nginx -t` with the duplicate directive.
  Do not alter the working implementation or publish the intentionally broken image.
- `bash docker/smoke-nginx.sh endgame-grocery:nginx-smoke` passes against the resulting image.
- PR CI includes the real image checks. README describes exactly what is and is not exercised.
- Run formatting/lint after code changes; finish with all required validation below. Record command
  outcomes and before/after evidence in the implementation handoff, including unavailable checks.

Suggested Conventional Commit subject:
`fix(container): restore nginx startup and reject invalid image configuration`

The implementer writes the final subject into the `next_task` HANDOFF Commit field and leaves
T-001 at `ready_for_review` without committing. The reviewer verifies the actual image checks.
After review, `commit_task` creates the task commit; user-reviewed changes require a PR to `main`
through `aide pr` under the repository policy. The planner neither commits nor launches other roles.

## Scope boundaries

No database or application feature changes, supervisor restart-policy redesign, base-image strategy
change or replacement of Alpine's main nginx configuration. The nginx-only smoke check does not
claim to exercise backend health, migrations, authenticated API traffic or full application startup.

## Validation

- Targeted: `node --test backend/src/nginxCaching.test.js backend/src/nginxLogging.test.js backend/src/containerHardening.test.js`
- `npm run lint`
- `npm run build`
- `npm test`
- Production-image build, original/fixed `nginx -t`, negative build check and smoke script as above.
- `git diff --check`
- Stage any newly created file explicitly: `git add docker/smoke-nginx.sh`.
