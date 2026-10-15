# ROADMAP

Goal: the `nginx-smoke-arm64` CI job can no longer hang for up to 6 hours, and it skips the
QEMU-emulated `npm ci --omit=dev` layer entirely while dependencies are unchanged.

Status: roadmap refinement (2026-10-15). All decisions are resolved (see end); ready for
`start_plan`.

## Incident (2026-10-15)

- CI run 38755842196 (push to `main`, merge of PR #93), job `nginx-smoke-arm64`: the step
  `docker buildx build --platform linux/arm64 --load …` hung from 14:56:42 UTC until it was
  cancelled manually at 15:20 UTC (> 23 minutes). The job log shows the last active layer was
  `[runtime 7/15] RUN npm ci --omit=dev`; every other layer had finished.
- The same code passed 6 minutes earlier as PR run 38754915169 in 3m20s. The previous nine runs of
  this job took about 3m10s–3m20s. In those runs the emulated `npm ci --omit=dev` layer takes
  about 117 s; it is the only long layer that runs under QEMU (the builder stage runs natively
  via `--platform=$BUILDPLATFORM`).
- Inputs were identical: `node:22-alpine` (`sha256:0a7108bf…`) and `tonistiigi/binfmt:latest`
  (`sha256:400a4873…`) had the same digests in both runs.
- Conclusion: a non-deterministic hang of npm/Node under QEMU arm64 emulation, not a code
  regression. The job has no `timeout-minutes`, so GitHub would only have stopped it after the
  default 360 minutes.

## Priority 1 — bound and avoid the emulated npm install in `nginx-smoke-arm64`

Objective: a hang fails the job quickly, and unchanged dependencies are served from the BuildKit
cache instead of re-running `npm ci --omit=dev` under QEMU.

Scope: only `.github/workflows/ci.yml`, job `nginx-smoke-arm64`.

- Add `timeout-minutes: 15` on the job level.
- Replace the `docker buildx build --platform linux/arm64 --load -t endgame-grocery:nginx-smoke-arm64 .`
  step with `docker/build-push-action`, pinned to the same SHA already used in
  `.github/workflows/docker-publish.yml` (`c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7`), with:
  - `context: .`, `platforms: linux/arm64`, `load: true`, `push: false`,
    `tags: endgame-grocery:nginx-smoke-arm64`;
  - `cache-from: type=gha,scope=nginx-smoke-arm64`;
  - `cache-to: type=gha,scope=nginx-smoke-arm64,mode=max` (`mode=max` so the builder-stage layers
    are cached as well).
- The "Check architecture and native bcrypt module" step and the `smoke-nginx.sh` step stay
  unchanged and keep using the loaded `endgame-grocery:nginx-smoke-arm64` image.
- Keep the existing `docker/setup-qemu-action` and `docker/setup-buildx-action` steps.

## Priority 2 — documentation

- `docs/DEVELOPMENT.md`, "Production nginx image smoke check" (paragraph on the independent
  `nginx-smoke-arm64` CI job): mention the 15-minute job timeout and the GitHub Actions BuildKit
  cache, including that a lockfile or `package.json` change re-runs the emulated install.
- The local commands in the "arm64 variant" subsection stay valid and unchanged (no cache flags
  needed locally).
- `.github/workflows/ci.yml`: update the comment above `nginx-smoke-arm64` to explain the timeout
  (QEMU npm hang) and the cache.

## Acceptance criteria

- `nginx-smoke-arm64` has `timeout-minutes: 15`.
- The image build uses `docker/build-push-action` pinned to
  `c3c9e263c25d99ce0380d002d59b67737d91b0dc` with `load: true`, `push: false`, platform
  `linux/arm64`, tag `endgame-grocery:nginx-smoke-arm64` and GHA cache (`scope=nginx-smoke-arm64`,
  `mode=max` on `cache-to`).
- The architecture/bcrypt check and `smoke-nginx.sh` steps are unchanged and pass in CI.
- On a second CI run without lockfile or `package.json` changes, the
  `[runtime 7/15] RUN npm ci --omit=dev` layer is reported as `CACHED` and the build step is
  clearly faster than the uncached ~2m45s (verified in the PR's CI runs; a rerun of the PR job is
  enough).
- No other job or workflow changes (`nginx-smoke`, `docker-publish.yml` untouched).
- Docs and the workflow comment are updated as listed in Priority 2.
- `npm run lint`, `npm run build`, `npm test` pass.

## Known limitation

- When `package-lock.json` or a `package.json` changes (for example dependency updates), the
  emulated `npm ci --omit=dev` runs again in full; then only the 15-minute timeout protects
  against a hang (a rerun is the remedy).
- `docker-publish.yml` keeps the same hang risk for the release arm64 build (decided out of scope).

## Out of scope

- `nginx-smoke` (amd64) and `docker-publish.yml`: no timeout or cache changes.
- Moving the production `npm ci --omit=dev` to a native `$BUILDPLATFORM` stage with
  `--cpu=arm64 --os=linux --libc=musl` (would change the published image and needs install-script
  review, especially `sharp`).
- Disabling `@scarf/scarf` analytics during the build.

## Decisions (user, 2026-10-15)

- D1 — Fixes: job timeout plus BuildKit GHA cache (options 1+2 from the analysis).
- D2 — Cache wiring: `docker/build-push-action` (already pinned in `docker-publish.yml`), not the
  CLI plus a runtime-token exposer action.
- D3 — Scope: only `nginx-smoke-arm64`.
- D4 — Timeout: 15 minutes.
