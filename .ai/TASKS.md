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
| T-001 | README & FUNDING.yml: add Support section (Buy Me a Coffee + GitHub Sponsors badges) and Built-with/vibe-coded section crediting aide/agentinit; create `.github/FUNDING.yml` | done | README has Support section with BMC image-link and Sponsors link; README has Built-with section with agentinit URL; `.github/FUNDING.yml` lists `buy_me_a_coffee: derflodev`; lint passes | `npm run lint`, `npm run build`, `npm test` passed; committed | none |
| T-002 | In-app Buy Me a Coffee link in InfoSheet: add donate section to `InfoSheet.jsx`, CSS rule, and test assertion | done | Info & Settings sheet renders a BMC link to `https://www.buymeacoffee.com/derflodev`; `InfoSheet.test.jsx` passes; lint and build pass | `npm run test --workspace frontend -- InfoSheet.test.jsx`, `npm run lint`, `npm run build`, `npm test` passed; committed | none |
