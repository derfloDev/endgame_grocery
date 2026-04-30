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
| T-001 | List item animations (fade-out on done/delete, fade-in on add/SSE events) | ready_for_implement | Entry rows animate out (300 ms fade+scale) when marked done or deleted locally or via SSE; new SSE-created rows animate in; recently-used chips animate in on re-add; prefers-reduced-motion disables animations | n/a | implement |
| T-002 | Spacing fixes (detail-meta, Add-item sheet, Share sheet, mobile keyboard scroll) | done | Owner→Enable-notifications gap ≈ 12 px; Mehr-anzeigen→Cancel gap ≈ 8 px; Send-Invite→notice gap consistent; Add-item input scrolls into view when keyboard opens on mobile | `npm run lint`; `npm run build`; `npm test` | none |
| T-003 | Mobile & visual fixes (FAB clipping, icon-browser shadow, divider line, scrollbar flash) | done | FAB fully visible with ≥ 16 px right margin on ≤ 375 px screens; icon-search glow not clipped; no border-top divider above icon-search input; no scrollbar flash on icon-browser collapse | `npm run lint`; `npm run build`; `npm test` | none |
| T-004 | Feature additions — rework: member badges right-aligned inside Owner chip row | done | Member initials badges sit on the same horizontal line as "Owner" chip, right-aligned via margin-left: auto; no separate row below | `npm run lint`; `npm run build`; `npm test` | none |
| T-005 | Feature removals (Active/All Lists toggle, stat chips, bottom-nav Lists tab) | done | No toggle or stat chips on OverviewPage; BottomNav absent from all pages; dead CSS and unused state removed | `npm run lint`; `npm run build`; `npm test` | none |
