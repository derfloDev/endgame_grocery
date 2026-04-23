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
