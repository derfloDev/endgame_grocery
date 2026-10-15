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
| T-001 | CI `nginx-smoke-arm64`: `timeout-minutes: 15` and build via pinned `docker/build-push-action` (same SHA as docker-publish.yml; arm64, `load: true`, `push: false`, GHA cache `scope=nginx-smoke-arm64`, `mode=max`); workflow tests first in `backend/src/releaseWorkflow.test.js`; workflow comment and `docs/DEVELOPMENT.md` updated (see .ai/PLAN.md Phase 1) | done | Job has 15-min timeout; no `docker buildx build` run line; build-push-action step with all listed inputs, SHA equal to docker-publish.yml; bcrypt check and smoke steps unchanged and in order; no other job/workflow changed, no write permission; new tests fail before and pass after; lint/build/test pass; post-push: job passes and PR rerun shows `npm ci --omit=dev` as `CACHED` | Tests-first: 4 expected failures; final lint/build/test and diff check pass (985 frontend + 425 backend tests); PR CI/cache-hit evidence pending; review PASS_WITH_NOTES (see .ai/REVIEW.md) | none |
