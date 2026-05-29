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
| T-006 | Changed Badges — server-side per-user last-viewed tracking, changed_count on lists, is_changed on entries, badges in UI | done | Overview shows changed_count badge; detail shows per-entry NEW/EDITED/DONE badge; badges clear on open; own changes not counted | `node --test src/db/migrations.test.js src/entries.test.js src/lists.test.js` pass; `npm run test --workspace frontend -- EntryTile ListCardHome ListDetailPage` pass; `npm run test --workspace frontend -- app` pass; `npm run lint` pass; `npm run build` pass; `npm test` pass | none |
| T-009 | Fix entry change badges — remove premature clearChangedFlags; reposition badge flush with card border | done | Badge visible on first open; positioned at top-right corner; gone on next open; EntryTile tests pass | Implemented; reviewed as part of T-010 (combined review PASS); committed via `commit_task T-009` | none |
| T-010 | Fix badge overflow and done-item section — corner-flush badge (overflow:hidden), done+changed entries in recently-used section | done | Badge inside tile corner (no overflow); done+changed entries not in open section; done badge in recently-used; tests pass | `npm run test --workspace frontend -- EntryTile RecentlyUsedSection ListDetailPage recentlyUsedState` passed; `npm run lint` pass; `npm run build` pass; `npm test` pass; committed via `commit_task T-010` after combined review PASS | none |
| T-011 | Fix badge corner radius (calc(--radius-md - 1px)), sharp bottom-left (0), self-done badge on toggle | done | Badge top-right seamlessly flush (no clip artefact); bottom-left radius 0; Done badge appears immediately when user themselves completes an item; tests pass | `npm run test --workspace frontend -- EntryTile RecentlyUsedSection ListDetailPage` failed before implementation, then passed after implementation; `npm run lint` pass; `npm run build` pass; `npm test` pass; committed via `commit_task T-011` | none |
| T-012 | Fix re-add to open duplicating item in recently-used section — exclude open-text matches from changedDoneItems in getRecentlyUsedDisplayState | done | Re-adding a recently-used item to open no longer shows it in both open and recently-used simultaneously; existing recentlyUsedState tests pass; no regression on changedDone badge logic | `npm run test --workspace frontend -- recentlyUsedState` hit sandbox `spawn EPERM`, then failed before implementation after escalation, then passed after implementation; `npm run lint` pass; `npm run build` pass; `npm test` pass; committed via `commit_task T-012` | none |
| T-013 | Restore dismiss controls on recently-used chips — server-side dismissed_history table, × button per chip, clears on re-add | ready_for_implement | × button visible on each chip (hidden when changedDone badge is showing); tapping × removes item immediately and persists dismissal server-side; re-adding an item clears its dismissal; i18n de+en; tests pass | — | implement |
