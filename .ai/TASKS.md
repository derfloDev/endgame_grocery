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
| T-001 | Auto-drain queue after PWA idle: add `visibilitychange` listener + drain on queue-changed when online + isSyncingRef guard | done | visibilitychange while online triggers drain; new mutation while online triggers drain; no concurrent drain runs; existing online/offline behavior unchanged | `npm run lint`; `npm run build`; `npm test` | none |
| T-002 | Discard non-retriable 4xx sync failures: detect 4xx in drainQueue, expose failedMutationId + discardFailedMutation in context, render Discard button in OfflineBanner, add i18n keys | done | 4xx sets syncError + failedMutationId; 5xx keeps retry behavior; Discard button removes mutation + clears error + re-drains; both locales have offline.discard key | `npm run lint`; `npm run build`; `npm test` | none |
