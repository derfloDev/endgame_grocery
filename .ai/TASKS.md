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

Privacy constraint for every task: omit personal deployment domains and URLs from repository files and evidence; use reserved example domains and relative resource paths. Recorded at 2026-10-12T10:53:37Z.

| Task ID | Scope | Status | Owner Role | Acceptance Criteria | Evidence | Next Role |
| --- | --- | --- | --- | --- | --- | --- |
| T-001 | Restore Android PWA notification opt-in with localized failure feedback and retry without reload | done | none | Confirm and correct the worker lifecycle failure; shared-list opt-in succeeds with an active worker; failures settle with localized feedback; retry can recover without reload; production browser regression and Android Chrome/Brave verification are recorded; affected documentation is updated | .ai/PLAN.md; implementation handoff at 2026-10-12T06:46:05Z; lint/typecheck/build pass; 1335 unit tests and 4 production browser checks pass; live Access remediation and Android device verification pending; review PASS_WITH_NOTES at 2026-10-12T06:58:08Z (.ai/REVIEW.md); commit_task at 2026-10-12T06:59:10Z | none |
| T-002 | Document public PWA assets and Cloudflare cache rules; cover stale-worker recovery | done | none | README explains public paths/exposure, Access versus cache bypass, origin/browser/edge TTL, targeted purge and live verification; real production-worker regression covers retired JS 404 and same-page recovery; existing assertions and application behavior preserved; required validations pass | .ai/PLAN.md; implementation handoff at 2026-10-12T12:10:02Z; lint/typecheck/build and full unit suite pass; 5 production browser checks, 11 origin tests and production-image HTTP smoke pass; live rollout remains T-003; review PASS_WITH_NOTES at 2026-10-12T12:31:36Z (.ai/REVIEW.md); commit_task at 2026-10-12T14:36:16Z | none |
| T-003 | Apply and verify durable live PWA Access/cache configuration after T-002 | done | none | T-002 done; effective worker/shell no-cache and edge bypass verified; public worker/precache resources available with Access restored; private/API routes protected; normal worker activates and stays consistent across next real deployment; installed Android opt-in verified; README and rollout evidence updated; missing required live evidence prevents completion | .ai/PLAN.md; post-deployment checks at 2026-10-13T06:52:55Z: user reports deployment without purge and good operation; Android opt-in confirmed; worker/static resources, Access/cache responses and native activation pass; unchanged worker content; exact deployed image comparison and stale normal icon cleanup pending; user reports full cache purge incl. icons and requests closure at 2026-10-13T13:42:32Z; delivery/reload/Brave/image-digest gaps recorded in README and ROADMAP; commit_task at 2026-10-13T13:42:32Z | none |
