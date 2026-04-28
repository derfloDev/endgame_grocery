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
| T-001 | DB migration + backend API: add `details` column to `entries`; expose in GET, POST, PATCH routes | done | Migration file exists; GET returns `details`; POST stores it; PATCH preserves when absent, updates when present, clears when blank; all entry tests pass | `npm run lint` (pass with existing frontend warning), `npm run build`, `npm test`, `npm run test --workspace backend -- src/entries.test.js`, `npm run test --workspace backend -- src/db/migrations.test.js` | none |
| T-002 | Frontend: `details` field in AddItemSheet, display in EntryRow, wired through ListDetailPage and API client | done | AddItemSheet renders "Details (optional)" input with correct placeholder; onAdd called with details as 3rd arg; edit mode pre-fills from initialDetails; EntryRow shows subordinate details line when non-empty; ListDetailPage passes details through add/edit paths; all frontend tests pass | `npm run test --workspace frontend -- src/components/entry-row.test.jsx`, `npm run test --workspace frontend -- src/components/AddItemSheet.test.jsx`, `npm run test --workspace frontend -- src/app.test.jsx`, `npm run lint` (pass with existing frontend warning), `npm run build`, `npm test` | none |
| T-003 | Frontend: always render fallback icon (IconShoppingCart) in RecentlyUsedSection and AutocompleteSuggestions chips when no icon is set | done | RecentlyUsedSection chip shows SVG icon when item.icon is null; AutocompleteSuggestions chip shows SVG icon when suggestion.icon is null; existing no-icon test updated to expect fallback icon; all tests pass | `npm run test --workspace frontend -- src/components/RecentlyUsedSection.test.jsx` pass (required escalation because sandbox blocked `esbuild` spawn); `npm run test --workspace frontend -- src/components/AutocompleteSuggestions.test.jsx` pass (required escalation because sandbox blocked `esbuild` spawn); `npm run lint` (pass with existing frontend warning), `npm run build`, `npm test` | none |
| T-004 | Frontend: expand icon registry with 45 new food/health/household icons from Tabler and Lucide; update iconDatabase.js entries | done | All 45 new icons importable and visible in the icon browser; iconDatabase.js updated entries use new specific icons; `npm run build` passes with no missing-export errors; `npm test` passes | `npm run test --workspace frontend -- src/utils/cosineSimilarity.test.js`, `npm run lint` (pass with existing frontend warning), `npm run build`, `npm test` | none |
