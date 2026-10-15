# Plan

Status: **ready_for_implement** (T-001 planned by `start_plan` on 2026-10-15)

Goal: implement the scope defined in `ROADMAP.md`. The `nginx-smoke-arm64` CI job must no longer
hang for up to 6 hours, and while dependencies are unchanged it must skip the QEMU-emulated
`npm ci --omit=dev` layer by using the BuildKit cache. Root cause (ROADMAP "Incident"): CI run
38755842196 hung for more than 23 minutes in `[runtime 7/15] RUN npm ci --omit=dev` under QEMU,
and the job has no `timeout-minutes`, so GitHub's default is 360 minutes.

Decisions (ROADMAP.md, 2026-10-15):
- D1: job timeout plus BuildKit GHA cache.
- D2: wire the cache through `docker/build-push-action`, pinned to the same SHA as
  `docker-publish.yml`.
- D3: change only `nginx-smoke-arm64`.
- D4: 15-minute timeout.

## Scope

One task:

- **T-001**: in `.github/workflows/ci.yml`, job `nginx-smoke-arm64`, add `timeout-minutes: 15`
  and replace the `docker buildx build` run step with a pinned `docker/build-push-action` step
  (arm64, `load: true`, `push: false`, GHA cache with `scope=nginx-smoke-arm64`,
  `mode=max`). Add workflow tests for this. Update the workflow comment and
  `docs/DEVELOPMENT.md`.

Out of scope:
- No change to `nginx-smoke` (amd64), `docker-publish.yml`, `release-please.yml` or the
  `Dockerfile`.
- No native `$BUILDPLATFORM` prod install.
- No disabling of Scarf analytics.
- No new actions besides the already used `docker/build-push-action` pin.

## Acceptance Criteria

T-001
- `nginx-smoke-arm64` declares `timeout-minutes: 15` on the job level.
- The job no longer contains a `docker buildx build` run step. Instead it has a
  `docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7` step (the same SHA as
  `docker-publish.yml`) with:
  - `context: .`
  - `platforms: linux/arm64`
  - `load: true`
  - `push: false`
  - `tags: endgame-grocery:nginx-smoke-arm64`
  - `cache-from: type=gha,scope=nginx-smoke-arm64`
  - `cache-to: type=gha,scope=nginx-smoke-arm64,mode=max`
- These steps stay in the job and keep their order and content:
  - `actions/checkout`, `docker/setup-qemu-action` and `docker/setup-buildx-action`;
  - "Check architecture and native bcrypt module", which runs
    `docker run --rm --platform linux/arm64 --entrypoint sh endgame-grocery:nginx-smoke-arm64 …`;
  - `bash docker/smoke-nginx.sh endgame-grocery:nginx-smoke-arm64` with
    `DOCKER_DEFAULT_PLATFORM: linux/arm64`.
- No other job or workflow changes. Workflow-level `permissions: contents: read` stays, and no
  `: write` permission is added. The existing workflow-hardening tests keep passing: every
  action is pinned to a full SHA with a `# vN` comment.
- New tests in `backend/src/releaseWorkflow.test.js` (written before the workflow change and
  failing against the current `ci.yml`) assert:
  - the timeout;
  - the build-push-action step and its inputs;
  - the absence of the `docker buildx build` run line;
  - that the bcrypt check and smoke steps are still present;
  - that the build-push-action SHA in `ci.yml` equals the one in `docker-publish.yml`.
- Docs are updated as listed in the files below.
- `npm run lint`, `npm run build` and `npm test` pass.
- CI evidence after push. This needs the PR, so it is checked by the human or reviewer on the
  PR's CI and is not reproducible locally:
  - the job passes;
  - on a rerun without lockfile or `package.json` changes, the
    `[runtime 7/15] RUN npm ci --omit=dev` layer is reported as `CACHED` and the build step is
    clearly faster than the uncached ~2m45s.

## Implementation Phases

### Phase 1 — T-001: bound and cache the arm64 smoke build

Files to change:
- `backend/src/releaseWorkflow.test.js` (tests first)
- `.github/workflows/ci.yml`
- `docs/DEVELOPMENT.md` (documentation)

Steps:

1. **Tests first** (`backend/src/releaseWorkflow.test.js`, `describe("workflow hardening")` or a
   new `describe("arm64 smoke job")`):
   - Add a helper that extracts one job block from `ci.yml`: the text from `^  <job>:\n` up to
     the next line matching `^  [a-z0-9-]+:` or the end of the file. Use the existing
     `readRepoFile`, which already normalises CRLF.
   - Test "ci.yml bounds the arm64 smoke job with a timeout": the `nginx-smoke-arm64` block
     matches `^ {4}timeout-minutes: 15$`.
   - Test "ci.yml builds the arm64 smoke image with build-push-action and the GHA cache":
     - The block matches `uses: docker/build-push-action@[0-9a-f]{40} # v7`.
     - It matches each of these inputs:
       - `context: .`
       - `platforms: linux/arm64`
       - `load: true`
       - `push: false`
       - `tags: endgame-grocery:nginx-smoke-arm64`
       - `cache-from: type=gha,scope=nginx-smoke-arm64`
       - `cache-to: type=gha,scope=nginx-smoke-arm64,mode=max`
     - It does not match `docker buildx build`.
   - Test "ci.yml keeps the arm64 architecture, bcrypt and nginx smoke checks":
     - The block still contains `name: Check architecture and native bcrypt module`,
       `bash docker/smoke-nginx.sh endgame-grocery:nginx-smoke-arm64` and
       `DOCKER_DEFAULT_PLATFORM: linux/arm64`.
     - The build-push-action step comes before the bcrypt check, which comes before the
       smoke script (compare `indexOf`).
   - Test "ci.yml and docker-publish.yml pin the same build-push-action commit": extract the
     40-hex SHA after `docker/build-push-action@` from both files and `assert.equal` them.
   - Run `npm test` and confirm the new tests fail for the expected reasons before step 2.
2. **Workflow** (`.github/workflows/ci.yml`, job `nginx-smoke-arm64` only):
   - Add `timeout-minutes: 15` directly under `runs-on: ubuntu-latest`.
   - Replace `- run: docker buildx build --platform linux/arm64 --load -t endgame-grocery:nginx-smoke-arm64 .`
     with:
     ```yaml
           - uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7
             with:
               context: .
               platforms: linux/arm64
               load: true
               push: false
               tags: endgame-grocery:nginx-smoke-arm64
               cache-from: type=gha,scope=nginx-smoke-arm64
               cache-to: type=gha,scope=nginx-smoke-arm64,mode=max
     ```
     `context: .` is required. Without it the action uses the Git context of the ref and not
     the checked-out workspace.
   - Leave all other steps untouched.
   - Extend the comment above the job, keeping it short and in English. It should say that:
     - the job is bounded by a 15-minute timeout because the emulated `npm ci --omit=dev` can
       hang under QEMU;
     - BuildKit layers are cached in the GitHub Actions cache (scope `nginx-smoke-arm64`,
       `mode=max` so builder-stage layers are included), so unchanged dependencies skip the
       emulated install;
     - a lockfile or `package.json` change re-runs the emulated install.
   - Do not add `actions: write` or any other permission. The GHA cache backend uses the runner's
     runtime token, which build-push-action passes to BuildKit, and the
     `ci.yml only needs read access` test must keep passing.
3. **Documentation** (`docs/DEVELOPMENT.md`, section "Production nginx image smoke check"):
   - Extend the sentence about the independent `nginx-smoke-arm64` CI job (currently line 129).
     It should say that the job:
     - builds with `docker/build-push-action` using the GitHub Actions BuildKit cache, so
       unchanged dependencies skip the emulated `npm ci --omit=dev`;
     - re-runs the full emulated install after a lockfile or `package.json` change;
     - is limited to 15 minutes because npm can hang under QEMU, and a timed-out job should be
       re-run.
   - Leave the local commands in "arm64 variant" unchanged. They remain valid and need no
     cache flags.
4. **Validate**: `npm run lint`, `npm run build`, `npm test`, and `git diff --check`.
   - Check that the diff touches only the three files above plus the `.ai/` artifacts.
   - Confirm the `ci.yml` diff is limited to the `nginx-smoke-arm64` job block and its comment.

Suggested commit message (implementer finalises it in the HANDOFF `Commit` field):
`ci(docker): stop the arm64 image smoke check from hanging for hours and reuse cached dependency layers`

## Risks and notes

- **Cache size:** `mode=max` stores the builder and runtime layers, including `node_modules`
  with `onnxruntime-node` and `sharp`. The GHA cache has a 10 GB repository limit with LRU
  eviction, so eviction only causes a cache miss and no failure.
- **Cache scope per branch:** a PR can read the cache from `main`, but `main` cannot read PR
  caches. The first run on a new ref may therefore miss the cache, and the PR rerun is the
  verification point.
- **Build summary:** build-push-action v7 adds a build summary and a build-record artifact to the
  job. This is harmless and uses the runtime token, with no repo permission needed. Do not
  disable it unless it breaks the job.
- **Timeout misses on full installs:** if the 15-minute timeout ever triggers on a legitimate
  uncached run, raise the value through a new roadmap decision. Do not change it silently.

## Validation
- `npm run lint`
- `npm run build`
- `npm test`
- `git diff --check`
- Post-push (PR CI, human or reviewer): `nginx-smoke-arm64` passes; a rerun shows the
  `npm ci --omit=dev` layer as `CACHED`.
