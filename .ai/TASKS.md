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
| T-006 | Expanded icon set (registry only, no DB): 7 tabler/lucide candidates (IconSock, IconPants, IconShoe, IconPineapple, Watermelon, IconFlame, IconCan) + 11 custom SVGs (CottonSwabs, WetWipes, InterdentalSticks, CreamTube, CreamJar, Mango, Kiwi, Peach, Plum, Blueberries, ELiquid); tabler/lucide fallback documented where icons were absent | done | All new icons appear in icon browser; custom SVGs render at size=22 and size=32 with currentColor stroke; lint, build, and tests pass | `npm run test --workspace frontend -- iconRegistry.test.js`; `npm run lint`; `npm run build`; `npm test` | none |
| T-005 | Comprehensive iconDatabase.js enrichment (runs after T-006): redirect garlic→CustomGarlic, pasta→CustomPasta, grapes→IconGrape; add DB entries for all custom icons T-002–T-004 and all T-006 icons (Groups A+B+C); enrich every existing entry to ≥5 tags | done | garlic/knoblauch→CustomGarlic; pasta/nudeln→CustomPasta; all T-006 icons are suggested; every entry has ≥5 tags; lint, build, and tests pass | `npm run test --workspace frontend -- cosineSimilarity.test.js`; `npm run test --workspace frontend -- iconRegistry.test.js`; `npm run lint`; `npm run build`; `npm test` | none |
| T-007 | Food & Produce: 19 custom SVG icons (Tomato, Cucumber, BellPepper, Onion, Potato, BreadRoll, Baguette, Rice, Jam, PastaSauce, Chips, Fries, Chocolate, FrozenVegetables, FrozenBerries, Butter, Cream, Yogurt, Quark) + DB redirects from generic icons + enriched tags; verify tabler IconChocolate/IconFries/IconBaguette/IconTomato first | done | All 19 icons appear in icon browser and render at size=22/size=32 with currentColor stroke; existing DB entries redirect to new icons; lint, build, and tests pass | `npm run test --workspace frontend -- iconRegistry.test.js`; `npm run test --workspace frontend -- cosineSimilarity.test.js`; `npm run lint`; `npm run build`; `npm test` | none |
| T-008 | Drugstore & Household: 19 custom SVG icons (Shampoo, Conditioner, BodyWash, Toothbrush, Mouthwash, ShavingCream, Sunscreen, AfterSun, Diapers, GlassesCleaner, CleaningCloth, StorageBags, BakingPaper, Foil, Sponge, HandSoap, FabricSoftener, Detergent, PaperTowels) + DB redirects from generic icons + enriched tags; verify tabler IconMop first | ready_for_implement | All 19 icons appear in icon browser and render at size=22/size=32 with currentColor stroke; existing DB entries redirect to new icons; lint, build, and tests pass | n/a | implement |
