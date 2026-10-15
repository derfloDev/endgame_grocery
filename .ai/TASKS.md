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
| T-001 | Service worker: network-first navigations (3 s timeout, `__reconnect` disables timeout) with precached `/index.html` fallback; navigation route registered before the precache route; no runtime caching of navigation responses; docs in DEVELOPMENT.md and SETUP.md (see .ai/PLAN.md Phase 1) | done | 2xx/redirect/401/403/`cf-mitigated: challenge` navigation responses pass through; reject/timeout/other non-OK fall back to the precached shell; `/` uses the navigation route; login/redirect responses never cached (offline reload still shows shell); unit tests + `e2e/pwa-navigation.spec.js` pass; lint/build/test pass | lint/build/test pass; frontend 934 + backend 421 tests; production PWA suite 9 passed (elevated for process cleanup); git diff --check pass | none |
| T-002 | Edge-gate detection (`redirect: "manual"`, opaqueredirect/3xx, `cf-mitigated`, non-JSON 401/403) as reachability `gated` separate from `offline`; gated writes queued and GETs cached; reconnect banner (EN/DE) with Reconnect button via `__reconnect`; param stripped on startup; console reason logging; docs in DEVELOPMENT.md, SETUP.md, README.md (see .ai/PLAN.md Phase 2) | done | Gated state never shows offline banner nor sets `isOffline`; no `auth:expired` for gate responses, backend JSON 401 unchanged; queue survives and drains exactly once after reconnect; real offline unchanged; unit tests + `e2e/edge-gate.spec.js` pass; lint/build/test pass | lint/typecheck/build/test pass; frontend 979 + backend 421 tests; edge-gate/queue-retry/resync E2E 7 passed; rework dev discovery 18 tests excludes both production specs, dedicated PWA discovery 9 tests retained; git diff --check pass | none |
| T-003 | Review polish from ROADMAP follow-up N1/N2: while gated, `OfflineBanner` also shows a blocked queued change's error text and Discard button; unit test asserts the app and service-worker `RECONNECT_PARAM` values are equal; comments in both files name the test; docs in DEVELOPMENT.md and SETUP.md (see .ai/PLAN.md Phase 3) | done | Gated + `failedMutationId`: reconnect message, Reconnect, error text (EN/DE, server and translated) and Discard all visible, each button triggers only its own action; gated without failed mutation unchanged; discard while gated removes the row without any request and stays gated; equality test present and passing; lint/build/test pass; `e2e/edge-gate.spec.js` still passes | lint/typecheck/build/test pass; frontend 985 + backend 421 tests; edge-gate E2E 3 passed; targeted 75 tests pass; git diff --check pass | none |
