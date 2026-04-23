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
| T-001 | Integrate logo PNG as PWA icon and README header | done | icon-192.png and icon-512.png in frontend/public; SVG icons removed; vite.config.js and index.html updated; README shows logo image; lint and build pass | icon dimensions verified with Node PNG header read; npm run lint PASS with existing react-refresh warning; npm run build PASS; review PASS | none |
| T-002 | Dockerize: single image with nginx + Node.js via supervisord | done | Dockerfile builds; docker-compose.example.yml starts app+postgres; /api/health returns ok through nginx; SPA fallback works; env.js loads .env conditionally; README Docker section added; lint and build pass | env fallback test added and passing; Docker artifacts added and statically checked; npm run lint PASS with existing react-refresh warning; npm run build PASS; npm test PASS; Docker CLI unavailable in this environment; review PASS_WITH_NOTES | none |
| T-003 | Switch docker-compose.example.yml to pull image from registry instead of building locally | done | build: block removed; image: references ghcr.io/derfloDev/endgame-grocery:latest; README Docker section updated (no --build flag, pull-based workflow documented); lint passes | build block removed; image set to ghcr.io/derfloDev/endgame-grocery:latest; README pull workflow documented; npm run lint PASS with existing react-refresh warning; npm run build PASS; review PASS | none |
| T-004 | CI/CD pipeline: GitHub Actions CI on all branches/PRs + Release Please + GHCR Docker publish on release | done | ci.yml with lint-and-build + unit-test + e2e jobs; e2e uses postgres service container; release-please.yml with Release Please + docker-publish on release_created; package.json has version field; README has CI badge and CI/CD section; lint passes | ci.yml and release-please.yml added; root package version set to 0.1.0; README badge and CI/CD section added; npm run lint PASS with existing react-refresh warning; npm run build PASS; static workflow checks PASS; review PASS | none |
