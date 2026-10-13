# TASKS

Use this board to coordinate handoff between planner, implementer, and reviewer.

Status values:
- `in_planning`
- `ready_for_implement`
- `in_implementation`
- `ready_for_review`
- `in_review`
- `ready_to_commit`
- `changes_requested`
- `done`

Command expectations:
- planner moves tasks into `in_planning` and `ready_for_implement`
- implementer moves tasks into `in_implementation`, `ready_for_review`, and `done`, and resumes work from `changes_requested` and `ready_to_commit`
- reviewer moves tasks into `in_review`, `ready_to_commit`, or `changes_requested`
- `status_cycle` should report deterministic task status, current owner role, and next recommended action based on this board

| Task ID | Scope | Status | Acceptance Criteria | Evidence | Next Role |
| --- | --- | --- | --- | --- | --- |
| T-001 | Multi-arch Docker image (linux/amd64 + linux/arm64) for Raspberry Pi: Dockerfile builder on `$BUILDPLATFORM`, QEMU/Buildx multi-platform publish, new `nginx-smoke-arm64` CI job, README platform + arm64 smoke docs | done | publish builds `linux/amd64,linux/arm64` with unchanged tags; CI `nginx-smoke-arm64` asserts `aarch64`, loads `bcrypt` and passes `docker/smoke-nginx.sh`; existing CI jobs unchanged; new actions SHA-pinned; no toolchain added; README documents platforms/Pi 64-bit/arm64 smoke; lint/build/test pass | Local: arm64 build, aarch64+bcrypt check, arm64 and amd64 smokes pass; lint/build/test pass. Rework: added `platforms: linux/amd64,linux/arm64` to docker-publish.yml; nits fixed. Review round 2: PASS | none |
