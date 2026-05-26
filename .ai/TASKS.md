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
| T-001 | InfoSheet redesign: reorder sections (Language first), add section labels + dividers, fix clipboard copy error handling | done | (1) Language switcher rendered first. (2) Each section has an all-caps label with decorative divider lines. (3) Sections separated by border-top dividers. (4) Clipboard errors caught silently; button remains usable. (5) New tests for section order and clipboard error path pass. (6) lint + build + test green. | `npm run lint` (pass; existing AuthContext Fast Refresh warning), `npm run test --workspace frontend -- InfoSheet` (pass; rerun outside sandbox after spawn EPERM), `npm run build` (pass; existing Vite chunk-size warning), `npm test` (pass: frontend 422, backend 164) | none |
| T-002 | Fix double-divider lines and erroneous logout section label from T-001 | done | (1) Each labeled section has exactly one visual divider (the section-label `::before`/`::after` line). (2) No `border-top` line above section labels. (3) Logout section shows button only — no duplicate "Log out" label text. (4) Single `border-top` separates Logout from meta footer. (5) lint + build + test green. | `npm run lint` (pass; existing AuthContext Fast Refresh warning), `npm run test --workspace frontend -- InfoSheet` (pass: 14 tests), `npm run build` (pass; existing Vite chunk-size warning), `npm test` (first run hit known app.test timeout, targeted retry passed, second full run passed: frontend 423, backend 164) | none |
| T-003 | Add single divider line above Logout button | done | (1) Thin border-top divider visible above Logout button. (2) No other visual changes. (3) lint + build + test green. | `npm run lint` (pass; existing AuthContext Fast Refresh warning), `npm run test --workspace frontend -- InfoSheet` (pass: 14 tests), `npm run build` (pass; existing Vite chunk-size warning), `npm test` (pass: frontend 423, backend 164) | none |
| T-004 | Remove divider line below Logout button (between Logout and meta footer) | done | (1) No border-top between Logout button and Version row. (2) Divider above Logout (T-003) still present. (3) lint + build + test green. | `npm run lint` (pass; existing AuthContext Fast Refresh warning), `npm run test --workspace frontend -- InfoSheet` (pass: 14 tests), `npm run build` (pass; existing Vite chunk-size warning), `npm test` (pass: frontend 423, backend 164) | none |
| T-005 | Remove excessive bottom padding from InfoSheet sections | done | (1) No visible bottom gap below language toggle, username, and logout sections. (2) Top spacing between sections unchanged. (3) lint + build + test green. | `npm run lint` (pass; existing AuthContext Fast Refresh warning), `npm run test --workspace frontend -- InfoSheet` (pass: 14 tests), `npm run build` (pass; existing Vite chunk-size warning), `npm test` (pass: frontend 423, backend 164) | none |
