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
| T-001 | Styling Fixes — overview topbar padding, FAB bottom position, icon-browser grid min-height | done | Top padding 16px; FAB bottom 16px; icon grid always shows ≥ 2 rows with keyboard open | `npm run lint` pass; `npm run build` pass; `npm test` fails in existing frontend `src/app.test.tsx` timeout for "adds and edits entry details from the list detail sheet" | none |
| T-007 | ListDetailPage TopBar top-padding fix — change TopBar.module.css padding from 52px to 16px | done | `padding: 16px 16px 12px` in TopBar.module.css; lint + build pass | `npm run lint` pass; `npm run build` pass after rerun with longer timeout | none |
| T-002 | Enter-Key UX — pressing Enter in AddItemSheet title field submits the entry | done | Enter submits when text is non-empty; Details field unchanged; enterKeyHint="done"; test added | `npm run test --workspace frontend -- AddItemSheet` pass; `npm run lint` pass; `npm run build` pass; `npm test` pass | none |
| T-003 | New Icons — add dishwasherTabs, nutNougatCream, maultaschen, herbs custom SVG icons | done | 4 SVG files created; wired into customIcons.ts and iconRegistry.ts; build passes | `npm run test --workspace frontend -- iconRegistry` pass; `npm run lint` pass; `npm run build` pass; `npm test` pass | none |
| T-004 | PWA Update Banner — show reload prompt when new SW version is waiting | done | Banner appears when SW update detected; clicking reloads; dismiss hides for session; i18n de+en | `npm run test --workspace frontend -- UpdateBanner` pass; `npm run lint` pass; `npm run build` pass; `npm test` pass | none |
| T-008 | Icon Database — add synonym entries for dishwasherTabs, nutNougatCream, maultaschen, herbs; remove "nutella" tag from jam entry | done | Typing "spülmaschinentabs", "nutella", "maultaschen", "petersilie" each suggests the correct new icon; "nutella" no longer points to jam; tests pass | `npm run test --workspace frontend -- cosineSimilarity` failed before implementation, then passed after implementation; `npm run lint` pass; `npm run build` pass; `npm test` pass | none |
| T-005 | Push Notifications Debug & Fix — audit pipeline, add logging, fix confirmed bugs | done | Notifications delivered after another user adds an item; VAPID startup warning; English body text | `node --test src/pushWorker.test.js src/push.test.js src/app.test.js` failed before implementation, then passed after implementation; `npm run test --workspace frontend -- vite-config` failed before implementation, then passed after implementation; `npm run lint` pass; `npm run build` pass; `npm test` pass | none |
| T-006 | Changed Badges — server-side per-user last-viewed tracking, changed_count on lists, is_changed on entries, badges in UI | ready_for_implement | Overview shows changed_count badge; detail shows per-entry NEW/EDITED/DONE badge; badges clear on open; own changes not counted | n/a | implement |
