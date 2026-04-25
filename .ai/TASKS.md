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
| T-001 | Fix Release Please bootstrap: add `.release-please-manifest.json` and push `v0.1.0` tag to `main` | done | `.release-please-manifest.json` present with `{"." : "0.1.0"}`; tag `v0.1.0` visible on GitHub; Release Please CI passes on next `main` push | Manifest added; `git push origin v0.1.0` succeeded; `npm run lint`; `npm run build`; `npm test`; approved for commit in review | none |
| T-002 | Gate release on CI success: change `release-please.yml` trigger from `push` to `workflow_run` with CI success condition | done | `release-please.yml` uses `workflow_run` trigger; release-please job has `if: github.event.workflow_run.conclusion == 'success'`; a failing CI run on `main` does not produce a new release or Docker image | Updated `release-please.yml` trigger and success gate; documented CI gating in `README.md`; `npm run lint`; `npm run build`; `npm test`; approved for commit in review | none |
| T-003 | Update deprecated GitHub Actions to Node.js 24-compatible versions in `ci.yml` and `release-please.yml` | ready_for_implement | No Node.js 20 deprecation warnings; no `google-github-actions/release-please-action` deprecation warning; all CI jobs pass; all action versions updated per plan table | n/a | implement |
