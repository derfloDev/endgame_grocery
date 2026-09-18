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
- `status_cycle` should report deterministic task status, current owner role, and next recommended action

| Task ID | Scope | Status | Acceptance Criteria | Evidence | Next Role |
| --- | --- | --- | --- | --- | --- |
| T-001 | SSE reconnect manager: exponential backoff with jitter and cap, client-side heartbeat watchdog, immediate reconnect on `visibilitychange`/`online`, named `ping` heartbeat on the backend, shared connectivity state container, timing constants module. See `.ai/PLAN.md` Task T-001. | done | No token means no connection and no timer; a closed or errored stream reconnects with increasing delay capped at 30 s; no traffic within 45 s closes and reconnects even without an `error` event; `ping` re-arms the watchdog; `visibilitychange`/`online` reconnect immediately when unhealthy and no-op when healthy; unmount and token removal leave no stream and no pending timer; backend emits the named `ping` heartbeat and clients without a `ping` listener are unaffected. | Review round 1 `PASS_WITH_NOTES`, no required fixes. Lint, build and full tests pass (514 frontend, 174 backend); frontend typecheck clean for T-001 files; live SSE manual test captured two real `event: ping` frames 30 s apart; E2E blocked by missing local PostgreSQL (pre-existing). See `.ai/REVIEW.md` T-001 and review handoff 2026-09-18. | none |
| T-002 | Resync after reconnect and foreground return: `resyncVersion` with a 2 s dedupe window, overview and detail pages wired to the light reload path instead of the full loader, pending-sync entries preserved across a refetch. See `.ai/PLAN.md` Task T-002. | done | A list changed while the page was backgrounded appears after it becomes visible again without a manual reload; a reconnect immediately followed by a foreground return triggers exactly one resync; entries still queued for sync stay visible with their pending state; a resync does not put the detail page into its full-screen loading state. | Review round 1 `PASS_WITH_NOTES`, no required fixes. Lint, build and full tests pass on an idle machine (530 frontend / 174 backend); no new type errors; `npm run e2e -- e2e/resync.spec.js` passes twice in real Chromium, proving foreground refresh, single-resync dedupe and no full-page loader. Suite is contention-sensitive: see `.ai/REVIEW.md` T-002 findings 1 and 4. | none |
| T-003 | Reachability-based connectivity: `/api/health` probe with timeout, rate limiting and in-flight de-duplication as the source of truth, `navigator.onLine` demoted to a hint, offline queue triggered additionally on `pageshow` and `focus`. See `.ai/PLAN.md` Task T-003. | ready_for_implement | `navigator.onLine === true` with a failing probe reports offline and keeps queueing; `navigator.onLine === false` with a succeeding probe reports online and drains; repeated wake-ups issue at most one probe per 5 s window; an open SSE stream reports online without a probe. | n/a | implement |
| T-004 | Request timeouts and queue retry: 10 s timeout on every request including the drain `fetch`, aborts classified as network errors, transient (network/timeout/5xx) failures retried with capped backoff, 4xx kept permanent with the discard action, stalled-drain guard release, order and idempotency preserved across retries. See `.ai/PLAN.md` Task T-004. | ready_for_implement | A drain failing with a network error or 5xx retries automatically with increasing delay and no user interaction; a 4xx does not retry and still offers discard; a request past the timeout is treated as offline so reads fall back to cache and writes are queued; a drain interrupted mid-queue resumes in original order without resending synced mutations; a stalled drain cannot block the queue past 30 s. | n/a | implement |
