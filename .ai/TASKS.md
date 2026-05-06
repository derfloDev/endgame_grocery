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
| T-001 | i18n infrastructure: install packages, create `src/i18n.js`, create `src/locales/{en,de}/translation.json`, update `vite.config.js` globPatterns, import i18n in `main.jsx`, verify `<html lang>` syncs | done | `npm run build` succeeds; dist contains separate translation chunks for en and de; SW precache manifest includes json pattern; `document.documentElement.lang` updates on language change | `npm run lint`; `npm run build`; `npm test`; German locale scan found no reviewed ASCII-substituted forms; dist emitted `translation-BMjHrVUO.js` and `translation-B53lYTbO.js`; generated SW precache includes both translation chunks | none |
| T-002 | String extraction: replace all ~130 hardcoded UI strings in components and pages with `t()` calls; populate both locale files; use ICU plurals in OfflineBanner; fix German strings in AddItemSheet | ready_for_implement | All user-visible strings rendered via `t()`; both locale files fully populated; `npm run lint` passes; app renders correct language on load | n/a | implement |
| T-003 | Language Switcher UI: create `LanguageSwitcher.jsx` (DE/EN toggle), integrate into `InfoSheet`, write unit test | ready_for_implement | Toggle renders DE and EN buttons; clicking switches language immediately; selection persists to localStorage; `npm test` passes for LanguageSwitcher | n/a | implement |
