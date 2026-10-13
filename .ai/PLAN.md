# Plan

Status: **ready_for_implement**

Goal: publish `ghcr.io/derflodev/endgame-grocery` as a multi-arch image (`linux/amd64` + `linux/arm64`) so it runs on a Raspberry Pi 3/4/5 with a 64-bit OS (see `ROADMAP.md`, Priority 1).

## Resolved decisions (from roadmap refinement)

- QEMU emulation + Docker Buildx on `ubuntu-latest`; one job, one multi-arch manifest. No native arm64 runners, no matrix/digest merge.
- Platforms: `linux/amd64`, `linux/arm64` only. No `linux/arm/v7`.
- PR CI builds and smoke-tests an arm64 image (no push).
- Publish trigger stays `release: published`. No `workflow_dispatch`.
- No Buildx layer cache this cycle.

## Findings that shape the plan

- `bcrypt@6.0.0` (the only native runtime dependency) ships `prebuilds/linux-arm64/bcrypt.musl.node`. The arm64 Alpine runtime stage therefore does **not** need a compiler toolchain. Do not add `python3`/`make`/`g++`. Only revisit if the arm64 CI build actually fails on `bcrypt`, and then report it in the HANDOFF entry instead of silently adding tooling.
- The `builder` stage only produces static frontend assets (`/app/frontend/dist`), which are architecture-independent. It can run on `$BUILDPLATFORM` so Vite never runs under QEMU.
- `docker/smoke-nginx.sh` takes any local image tag and runs it with plain `docker run`. Docker CLI honors `DOCKER_DEFAULT_PLATFORM`, so the arm64 image can be smoke-tested without changing the script. Prefer this over editing the script. Only add a platform argument to the script if `DOCKER_DEFAULT_PLATFORM` turns out not to work on the runner, and document it if you do.
- Third-party actions in this repo are pinned by full commit SHA with a `# vN` comment. New actions must follow the same style. Resolve the SHA of the current major release tag, for example `gh api repos/docker/setup-qemu-action/git/ref/tags/<tag>` (dereference annotated tags). Never guess a SHA.

## Tasks

### T-001 — Multi-arch Docker image with arm64 CI check

Single task, single commit: Dockerfile, publish workflow, CI check and docs change together and only make sense together.

#### Files to change

1. `Dockerfile`
   - Change `FROM node:22-alpine AS builder` to `FROM --platform=$BUILDPLATFORM node:22-alpine AS builder`.
   - Add a short English comment above it: the builder only emits architecture-independent static assets, so it runs natively on the build host even during multi-arch builds.
   - Leave the `runtime` stage on the target platform (no `--platform`), and add a comment that `npm ci --omit=dev` there resolves the per-architecture `bcrypt` prebuild.
   - No other changes. The `ARG`/`ENV VITE_ICON_SIMILARITY_THRESHOLD` must still reach the builder stage.

2. `.github/workflows/docker-publish.yml`
   - Before the build step, add `docker/setup-qemu-action` and `docker/setup-buildx-action`, both SHA-pinned with `# vN` comments.
   - In `docker/build-push-action`, add `platforms: linux/amd64,linux/arm64`.
   - Keep the trigger, permissions, login, metadata tags (`{{version}}`, `latest`) and labels unchanged.

3. `.github/workflows/ci.yml`
   - Keep the existing `nginx-smoke` job unchanged (amd64).
   - Add a new independent job `nginx-smoke-arm64` (`runs-on: ubuntu-latest`, no `needs`) with a one-line comment that mirrors the existing smoke job's comment and mentions QEMU. Steps:
     1. checkout (same pinned SHA as the other jobs)
     2. `docker/setup-qemu-action` (pinned, same SHA as in docker-publish)
     3. `docker/setup-buildx-action` (pinned, same SHA as in docker-publish)
     4. `docker buildx build --platform linux/arm64 --load -t endgame-grocery:nginx-smoke-arm64 .`
     5. Architecture and native-module check, failing the job on any error:
        `docker run --rm --platform linux/arm64 --entrypoint sh endgame-grocery:nginx-smoke-arm64 -c 'test "$(uname -m)" = aarch64 && node -e "require(\"bcrypt\").hashSync(\"smoke\", 4)"'`
        (exact quoting is up to the implementer. It must assert `aarch64` and load and use `bcrypt` from `/app`.)
     6. `bash docker/smoke-nginx.sh endgame-grocery:nginx-smoke-arm64` with `env: DOCKER_DEFAULT_PLATFORM: linux/arm64`
   - No push, no registry login, no secrets.

4. `README.md` (documentation, required in this task)
   - **Docker Deployment** section (around "Compose pulls the app image from …"): add that the published image is multi-arch for `linux/amd64` and `linux/arm64` and that Docker picks the matching variant automatically. Raspberry Pi 3/4/5 needs a 64-bit OS (e.g. 64-bit Raspberry Pi OS). 32-bit ARM (`linux/arm/v7`) is not supported. Also note that multi-arch images start with the first release after this change, so older tags are amd64-only.
   - **Production nginx image smoke check** section: add a short subsection or paragraph for the arm64 variant. Prerequisites are Docker Buildx plus QEMU/binfmt (built into Docker Desktop; on Linux e.g. `docker run --privileged --rm tonistiigi/binfmt --install arm64`). Show the commands: `docker buildx build --platform linux/arm64 --load -t endgame-grocery:nginx-smoke-arm64 .` and `DOCKER_DEFAULT_PLATFORM=linux/arm64 bash docker/smoke-nginx.sh endgame-grocery:nginx-smoke-arm64`. Update the sentence about the `nginx-smoke` CI job so it also names the `nginx-smoke-arm64` job and its `aarch64`/`bcrypt` check.
   - The paragraph around line 109 ("CI also runs the production-image HTTP smoke check described below") stays accurate. Only touch it if wording becomes wrong.
   - Do **not** edit `CHANGELOG.md` (managed by release-please).

#### Out of scope

- `linux/arm/v7`, native arm runners, Buildx GHA cache, `workflow_dispatch`, re-publishing old tags.
- Changes to `docker-compose.example.yml`. The `image:` reference is unchanged and pulls the right architecture automatically.
- Any application code or backend/frontend tests.

#### Tests-first note

No JS behavior changes, so there are no new unit tests. The "test" for this task is the new `nginx-smoke-arm64` CI job: write it (step 3) before or together with the Dockerfile change, and treat its success as the acceptance check.

#### Acceptance criteria

- `nginx-smoke-arm64` job exists in `ci.yml`. It builds `linux/arm64` under QEMU, asserts `uname -m` = `aarch64`, loads and uses `bcrypt`, and passes `docker/smoke-nginx.sh` against the arm64 image. Any failure fails the job.
- The existing `nginx-smoke`, `lint-and-build`, `unit-test` and `e2e` jobs are unchanged.
- `docker-publish.yml` builds and pushes `linux/amd64,linux/arm64` with unchanged tags and labels, and all new actions are SHA-pinned.
- The Dockerfile builder stage uses `--platform=$BUILDPLATFORM`, the runtime stage is per target platform, and no compiler toolchain is added.
- A plain local `docker build -t endgame-grocery:nginx-smoke .` still works, and the amd64 smoke still passes when Docker is available.
- README documents the supported platforms, the Raspberry Pi 64-bit requirement, no 32-bit ARM, and the local arm64 smoke commands and CI job.
- `npm run lint`, `npm run build` and `npm test` pass.

#### Validation

- Required: `npm run lint`, `npm run build`, `npm test`.
- Workflow syntax: if `actionlint` is available, run it on `.github/workflows/*.yml`. Otherwise review the YAML carefully and state that in HANDOFF.
- If local Docker with Buildx and QEMU/binfmt is available (Docker Desktop on Windows has it built in), run the arm64 build, the arch/`bcrypt` check and the arm64 smoke locally. Also run the amd64 `docker build` and smoke. Record outcomes or "not run (reason)" in the HANDOFF `Validation` field. The authoritative check is the PR CI run of `nginx-smoke-arm64`.
- Post-release (not a gate for this task): `docker buildx imagetools inspect ghcr.io/derflodev/endgame-grocery:<version>` lists both platforms.

#### Commit message (for HANDOFF `Commit` field)

```
feat(docker): publish arm64 images for Raspberry Pi deployments

Release images are now built for linux/amd64 and linux/arm64, so the same
ghcr.io tag runs on a 64-bit Raspberry Pi. PR CI builds and smoke-tests the
arm64 image under QEMU, including a native bcrypt load check.
```
