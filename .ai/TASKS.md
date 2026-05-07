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
| T-001 | Add missing tabler/lucide icons (IconPaperBag, IconGrape, IconCannabis, IconBeef, IconBean, BicepsFlexed) to ICON_REGISTRY | done | All six icons appear in the icon browser and are selectable; lint and build pass | `npm run lint`; `npm run build`; `npm test` | none |
| T-002 | Custom icon infrastructure (fromCustomSVG factory) + CustomKornflakesBowl and CustomKornflakesBox example icons; update formatIconName for Custom prefix | done | Both Kornflakes icons render at size=22 and size=32 with currentColor stroke; appear in icon browser; formatIconName strips Custom prefix; lint and build pass | `npm run lint`; `npm run build`; `npm test` | none |
| T-003 | Refactor custom icon system: install vite-plugin-svgr, store kornflakesBowl.svg and kornflakesBox.svg as filesystem SVG files, replace fromCustomSVG() with normalizeCustomIcon() wrapper | done | SVG files exist under frontend/src/assets/icons/custom/; CustomKornflakesBowl and CustomKornflakesBox render at size=22 and size=32 with currentColor stroke; icon browser unchanged; lint, build, and tests pass | `npm run lint`; `npm run build`; `npm test` | none |
| T-004 | Add six custom SVG icons: CustomGarlic, CustomHummus, CustomDentalFloss, CustomToothpaste, CustomCottonPads, CustomPasta — SVG files + customIcons.js exports + iconRegistry.js entries + tests | done | All six icons appear in the icon browser and render at size=22 and size=32 with currentColor stroke; SVG files exist under frontend/src/assets/icons/custom/; formatIconName strips Custom prefix correctly; lint, build, and tests pass | `npm run test --workspace frontend -- iconRegistry.test.js`; `npm run lint`; `npm run build`; `npm test` | none |
