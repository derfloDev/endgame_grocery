# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **changes_requested**

Reviewed: 2026-10-13

#### Findings
1. **blocker** — `.github/workflows/docker-publish.yml` (`Build and push Docker image` step, ~line 33-40): `platforms: linux/amd64,linux/arm64` was never added to `docker/build-push-action`. The diff for this file only adds the QEMU and Buildx setup steps (`grep -rn platforms .github Dockerfile` returns nothing). Without `platforms`, the release build still produces a single `linux/amd64` image, so the core goal of T-001 (publish an arm64 image for Raspberry Pi) is not delivered, and the README claim "The published image is multi-arch" would be false. Required fix: yes.
2. **nit** — `.github/workflows/ci.yml` line 48: the `docker run ... endgame-grocery:nginx-smoke-arm64             -c '...'` command has a run of ~13 spaces where a line continuation (`\` + newline) was apparently intended. It works (shell collapses the spaces) but reads as a formatting accident. Suggested: split into a proper `\`-continued multi-line command. Required fix: no.
3. **nit** — `README.md` ~line 462-465: two consecutive blank lines before `#### arm64 variant`. Suggested: remove one. Required fix: no.

#### Required fixes
1. Add `platforms: linux/amd64,linux/arm64` to the `docker/build-push-action` `with:` block in `.github/workflows/docker-publish.yml`, keeping tags, labels, trigger and permissions unchanged.

#### Verification
##### Steps
- Re-read `.ai/TASKS.md`, `.ai/PLAN.md`, `.ai/REVIEW.md`, `.ai/HANDOFF.md`; reviewed `git diff` of `Dockerfile`, `ci.yml`, `docker-publish.yml`, `README.md`.
- Resolved action SHAs with `gh api repos/docker/setup-{qemu,buildx}-action/git/ref/tags/v4`: `99012661...` (qemu) and `f87e5991...` (buildx) match the pinned SHAs in both workflows.
- Parsed both workflow files with `js-yaml`: valid; `ci.yml` jobs are `lint-and-build, nginx-smoke, nginx-smoke-arm64, unit-test, e2e`; the diff of `ci.yml` has 0 removed lines, so existing jobs are unchanged. `actionlint` not installed.
- `npm run lint`: pass. `npm run build`: pass. `npm test`: 421 pass, 0 fail.
- `docker buildx build --platform linux/arm64 --load -t endgame-grocery:nginx-smoke-arm64 .`: success; image reports `linux/arm64`.
- Executed the exact `docker run` arch/bcrypt step extracted from `ci.yml`: exit 0 (`aarch64` asserted, `bcrypt.hashSync` works). Negative check (`= x86_64` assertion) exits 1, so the check fails when it should.
- `DOCKER_DEFAULT_PLATFORM=linux/arm64 bash docker/smoke-nginx.sh endgame-grocery:nginx-smoke-arm64`: pass.
- Plain `docker build -t endgame-grocery:nginx-smoke .` and `bash docker/smoke-nginx.sh endgame-grocery:nginx-smoke` (amd64): pass.
- Dockerfile: builder uses `--platform=$BUILDPLATFORM`; runtime stage is per target; no toolchain added.
##### Findings
- All acceptance criteria except the `docker-publish.yml` `platforms` setting are met (finding 1).
- README content matches the plan (platforms, Pi 64-bit, no arm/v7, older tags amd64-only, arm64 smoke commands, CI job mention).
- The multi-platform publish path itself (QEMU + Buildx + `platforms`) cannot be exercised locally; it is verified only by workflow inspection and can be confirmed post-release with `docker buildx imagetools inspect`.
##### Risks
- If merged as-is, the next release publishes amd64-only while the docs promise multi-arch.
- Fix is a one-line change; once applied, the remaining workflow wiring is consistent with the plan.

#### Open Questions
- None.

#### Verdict
`FAIL`

### Review Round 2

Status: **ready_to_commit**

Reviewed: 2026-10-13

#### Findings
1. **blocker (resolved)** — `docker-publish.yml` now sets `platforms: linux/amd64,linux/arm64` on `docker/build-push-action`; tags, labels, trigger and permissions are unchanged.
2. **nit (resolved)** — `ci.yml` arch/bcrypt command now uses a proper `\` line continuation.
3. **nit (resolved)** — the double blank line before `#### arm64 variant` in `README.md` is gone.

No new findings.

#### Required fixes
- None.

#### Verification
##### Steps
- Re-read `.ai/TASKS.md`, `.ai/PLAN.md`, `.ai/REVIEW.md`, `.ai/HANDOFF.md`; reviewed the rework diff of `docker-publish.yml`, `ci.yml` and `README.md`.
- Parsed both workflows with `js-yaml`: valid; the `build-push-action` `with:` block contains `platforms: linux/amd64,linux/arm64`; `ci.yml` jobs are unchanged apart from the added `nginx-smoke-arm64` (0 removed lines). `actionlint` not installed.
- `npm run lint`: pass. `npm run build`: pass. `npm test`: 421 pass, 0 fail.
- Rebuilt `linux/arm64` image locally with `docker buildx build --platform linux/arm64 --load`: success.
- Executed the `nginx-smoke-arm64` arch/bcrypt step exactly as parsed from the YAML: exit 0.
- `DOCKER_DEFAULT_PLATFORM=linux/arm64 bash docker/smoke-nginx.sh endgame-grocery:nginx-smoke-arm64`: pass. The amd64 build and smoke passed in round 1 and the Dockerfile has not changed since.
##### Findings
- All acceptance criteria are met.
##### Risks
- The multi-platform push itself runs only on `release: published` and cannot be exercised locally. After the first release, confirm with `docker buildx imagetools inspect ghcr.io/derflodev/endgame-grocery:<version>` that both platforms are listed.

#### Open Questions
- None.

#### Verdict
`PASS`
