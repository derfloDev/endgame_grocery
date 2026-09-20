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
| T-001 | Load the icon model on first use instead of at startup (`main.tsx`, `iconWorkerClient.ts`, `AddItemSheet.tsx`) | done | Cold load of `/lists/<id>` requests no `huggingface.co`, `hf.co` or `cdn.jsdelivr.net` host; adding an entry still yields an icon suggestion with a visible loading state; the model is fetched on sheet open only, with no idle or speculative warm-up and no `warmIconWorkerWhenIdle` occurrence left in the repository | 2026-09-20T17:34:32Z rework: unused idle helper/tests/docs removed; lint/build and 756 tests pass; cold-load Chromium spec passes on retry after a visibility timeout. Transfer budget belongs to T-006 per revised plan. Identifier references remain only in .ai workflow records; see HANDOFF.md. 2026-09-20T18:04:53Z review round 2 `PASS_WITH_NOTES`: lint/build PASS, backend 174/174, frontend 582/582 on re-run, cold-load E2E spec PASS; production-build browser check shows 0 workers and 0 model requests on cold load, then 1 worker and a `huggingface.co` fetch on sheet open, spinner for a non-catalogue term, instant exact match. Before committing, keep untracked `get-docker.sh` and `.claude/settings.local.json` out of the `git add -A`. | none |
| T-002 | Load the detail page exactly once and render entries without waiting for members (`useListDetailData.ts`, `listDetailUtils.ts`, `ListDetailPage.tsx`) | ready_for_implement | Each of `/api/lists`, `/entries`, `/history`, `/members`, `/mark-viewed` requested exactly once per visit even after lazy i18n resources arrive; entries visible as soon as `/entries` resolves; access error and member-load failures still surface translated | n/a | implement |
| T-003 | Render cached list data immediately, replace it with the network response (`client.ts`, `entries.ts`, `lists.ts`, `useListDetailData.ts`) | ready_for_implement | With a populated cache, entries render in the first frame after mount without a spinner, then get replaced by the server payload; cached value never applied after the network response; existing offline fallback and pending-entry merge unchanged | n/a | implement |
| T-004 | Stop probing `/api/health` at startup when the offline queue is empty (`OfflineQueueContext.tsx`) | ready_for_implement | No `/api/health` request on mount with an empty queue; a queued mutation still probes, drains, and retries; offline banner and recovery behaviour unchanged | n/a | implement |
| T-005 | Self-host and precache the app fonts (`index.html`, `frontend/public/fonts/`, `vite.config.ts`) | ready_for_implement | No request to `fonts.googleapis.com` or `fonts.gstatic.com`; Lighthouse reports no third-party render-blocking stylesheet; typography visually unchanged; fonts render while offline; licences documented | n/a | implement |
| T-006 | Cut the cold-load transfer weight of the PWA icons, the logo and the precache manifest (`frontend/public/icon-512.png`, `frontend/public/icon-192.png`, `frontend/src/assets/endgame_grocery_logo.png`, `vite.config.ts`, `vite-config.test.ts`) | ready_for_implement | Cold load of `/lists/<id>` transfers < 500 KiB with no single response over 150 KiB, measured after T-005 has landed; `assets/iconWorker-*.js` is no longer precached; PWA icons stay 192×192 and 512×512 with `purpose: "any maskable"` and the app still installs and opens offline; icons and logo visually unchanged at rendered sizes | n/a | implement |
