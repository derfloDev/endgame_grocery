# ROADMAP

Goal: publish the app image as a multi-arch image so it also runs on a Raspberry Pi (64-bit).

## Priority 1 — Multi-arch Docker image (linux/amd64 + linux/arm64)

Objective: `ghcr.io/derflodev/endgame-grocery` images published on release contain both `linux/amd64` and `linux/arm64` variants under the same tags, so `docker compose pull` works unchanged on a Raspberry Pi 3/4/5 running a 64-bit OS.

### Decisions (resolved)

- Build approach: QEMU emulation on `ubuntu-latest` with Docker Buildx (single job, single multi-arch manifest). No native arm64 runners, no matrix/digest-merge workflow.
- Target platforms: `linux/amd64` and `linux/arm64` only. `linux/arm/v7` (32-bit Raspberry Pi OS) is out of scope.
- PR CI validates arm64 too (build without push), so arm64 breakages surface before a release.
- Trigger stays release-only (`release: published`). No `workflow_dispatch`; the next release delivers the first multi-arch image.

### Planned outcomes

- `.github/workflows/docker-publish.yml`:
  - sets up QEMU and Buildx (actions pinned by commit SHA, matching the existing pinning style)
  - builds and pushes with `platforms: linux/amd64,linux/arm64`
  - existing tags (`{{version}}`, `latest`) and labels stay unchanged
- `Dockerfile`:
  - the frontend `builder` stage runs on the build platform (`--platform=$BUILDPLATFORM`) because its output (static assets) is architecture-independent; this keeps the Vite build out of emulation
  - the `runtime` stage is built per target platform so `npm ci --omit=dev` installs the correct native `bcrypt` binary
  - if `bcrypt` has no usable arm64/musl prebuild, the runtime stage must install the required build toolchain only for the install step and keep the final image free of it (verify during implementation; do not add tooling unless needed)
- `.github/workflows/ci.yml`:
  - the existing amd64 `nginx-smoke` job stays as is
  - an arm64 check builds the image for `linux/arm64` under QEMU (no push), runs `docker/smoke-nginx.sh` against it, and verifies the native `bcrypt` module loads inside the arm64 image
- Documentation:
  - `README.md` Docker Deployment section states the supported platforms (`linux/amd64`, `linux/arm64`), that Raspberry Pi needs a 64-bit OS, and that 32-bit ARM is not supported
  - `README.md` smoke-check section documents how to run the arm64 smoke locally (Buildx + QEMU/binfmt prerequisite)

### Acceptance criteria

- `docker buildx imagetools inspect ghcr.io/derflodev/endgame-grocery:<version>` after the next release lists `linux/amd64` and `linux/arm64`.
- PR CI fails if the image cannot be built for `linux/arm64`, if nginx smoke fails on the arm64 image, or if `bcrypt` cannot be loaded in the arm64 image.
- amd64 image behavior, tags and existing CI checks are unchanged.
- `npm run lint`, `npm run build`, `npm test` pass.

### Constraints / risks

- QEMU makes the arm64 `npm ci --omit=dev` step noticeably slower; acceptable for release and CI. Buildx layer caching (e.g. GitHub Actions cache) is optional and only added if CI time becomes a problem — not required for this cycle.
- Real publish to GHCR can only be verified after the next release; pre-release verification relies on the CI arm64 build + smoke.
