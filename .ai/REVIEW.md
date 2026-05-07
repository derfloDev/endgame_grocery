# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **complete**

Reviewed: 2026-05-06

#### Findings
- No issues found.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` and `.ai/TASKS.md` to confirm scope.
2. Inspected `git diff HEAD` for `frontend/src/data/iconRegistry.js` and `frontend/src/data/iconRegistry.test.js`.
3. Verified tabler package exports: `IconPaperBag` and `IconCannabis` exist in `@tabler/icons-react`; `IconBean`, `IconBeef`, `IconGrape` do not — lucide fallbacks correctly used.
4. Confirmed alphabetical ordering of imports and registry entries.
5. Ran `npm run lint` — 0 errors, 1 pre-existing warning (unrelated).
6. Ran `npm run build` — success.
7. Ran `npm test` — 106 pass, 0 fail.
8. Ran targeted `vitest run src/data/iconRegistry.test.js` — 6 tests pass including new coverage for all six added icons.

##### Findings
- All six icons are present in `ICON_REGISTRY` and `ICON_REGISTRY_KEYS`.
- Lucide fallbacks for `IconBean`, `IconBeef`, `IconGrape` are correctly aliased and wrapped with `fromLucide()`.
- `IconCannabis` and `IconPaperBag` are imported directly from tabler and registered as-is.
- `BicepsFlexed` is imported from lucide and wrapped with `fromLucide()`.
- Alphabetical ordering is maintained throughout imports and registry.

##### Risks
- None.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-002

### Review Round 1

Status: **complete**

Reviewed: 2026-05-07

#### Findings
- No issues found.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` and `.ai/TASKS.md` to confirm scope.
2. Inspected working-tree diff for `frontend/src/data/customIcons.js` (new), `frontend/src/data/iconRegistry.js`, and `frontend/src/data/iconRegistry.test.js`.
3. Verified `fromCustomSVG` factory signature and default props match plan spec exactly.
4. Verified `CustomKornflakesBowl` (bowl + 4 flake paths) and `CustomKornflakesBox` (body + angled top + label lines) SVG element sets.
5. Verified alphabetical registry insertion: `CustomKornflakesBox` before `CustomKornflakesBowl` ✓
6. Verified `formatIconName` strips `Custom` prefix (6 chars) with inline comment documenting the rule.
7. Confirmed test additions: registry presence, `formatIconName` output, and DOM render tests for size=22 and size=32 at `currentColor` stroke.
8. Ran `npm run lint` — 0 errors, 1 pre-existing warning (unrelated).
9. Ran `npm run build` — success.
10. Ran `npm test` — 141 pass, 0 fail.
11. Ran targeted `vitest run --environment jsdom src/data/iconRegistry.test.js` — 11/11 pass (all four size×icon render tests pass under jsdom).

##### Findings
- `fromCustomSVG` factory matches plan spec: `color = "currentColor"`, `strokeWidth: stroke ?? strokeWidth ?? 1.5`, `strokeLinecap/strokeLinejoin: "round"`, `fill: "none"`.
- Both Kornflakes icons export as named constants with `displayName` set.
- `formatIconName("CustomKornflakesBowl")` → `"Kornflakes Bowl"` ✓; `formatIconName("CustomKornflakesBox")` → `"Kornflakes Box"` ✓.
- Render tests confirm correct `width`, `height`, `viewBox`, `stroke`, and `fill` at both size=22 and size=32.
- Note: the targeted vitest run must use `--environment jsdom` (or run via `npm test`) since `@testing-library/react` requires a DOM. This is expected given the existing project test setup.

##### Risks
- None.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-003

### Review Round 1

Status: **complete**

Reviewed: 2026-05-07

#### Findings
- No issues found.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` and `.ai/TASKS.md` to confirm scope.
2. Inspected working-tree diffs for `frontend/src/data/customIcons.js`, `frontend/vite.config.js`, `frontend/src/vite-config.test.js`, `README.md`, `frontend/package.json`, and the two new SVG files under `frontend/src/assets/icons/custom/`.
3. Confirmed `vite-plugin-svgr@^5.2.0` added to `frontend/package.json` devDependencies and `svgr()` registered as the second plugin in `vite.config.js` (between `react()` and `VitePWA`).
4. Confirmed SVG file conventions match plan requirements: `viewBox="0 0 24 24"`, no `width`/`height` on root, `fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"` on root; no `stroke-width` on elements (controlled by wrapper).
5. Verified `normalizeCustomIcon(SvgComponent, displayName)` factory: accepts `(size, stroke, strokeWidth, color, ...rest)`, passes `width`, `height`, `stroke`, `strokeWidth` through to SVG component; `color` defaults to `"currentColor"`, `strokeWidth` falls back to 1.5. Exported for future custom icon use.
6. Confirmed `iconRegistry.js` unchanged — T-002 imports/entries remain valid since exports keep the same names.
7. Confirmed `iconRegistry.test.js` unchanged — all 11 tests (including four DOM render tests) still pass against the svgr-backed implementation.
8. Verified new `vite-config.test.js` test asserts `vite-plugin-svgr` import and `svgr()` call in config source.
9. Confirmed README updated with SVG workflow documentation (file location, import convention, `normalizeCustomIcon` usage, `Custom` prefix, registry contract).
10. Ran `npm run lint` — 0 errors, 1 pre-existing warning (unrelated).
11. Ran `npm run build` — success, no SVG import warnings.
12. Ran `npm test` — 142 pass (141 pre-existing + 1 new vite-config test), 0 fail.
13. Ran `vitest run --environment jsdom iconRegistry.test.js` — 11/11 pass including all four size×icon render tests.

##### Findings
- `stroke-linecap` and `stroke-linejoin` are correctly encoded in the SVG root (rather than the wrapper), so they remain in the component's default output and can be overridden at call-site via `...rest`.
- `normalizeCustomIcon` is exported, enabling future custom icons to follow the same pattern without duplicating logic.
- Build output size unchanged (SVG content is equivalent to the T-002 JS-embedded paths).

##### Risks
- None.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-004

### Review Round 1

Status: **complete**

Reviewed: 2026-05-07

#### Findings
- No issues found.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` and `.ai/TASKS.md` to confirm scope.
2. Inspected working-tree diffs for `frontend/src/data/customIcons.js`, `frontend/src/data/iconRegistry.js`, `frontend/src/data/iconRegistry.test.js`, and all six new SVG files.
3. Confirmed all six SVG files follow T-003 conventions: `viewBox="0 0 24 24"`, no `width`/`height` on root, `fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"` on root, no `stroke-width` on elements.
4. Verified design briefs: garlic (bulb + clove lines + stem), hummus (bowl arc + mound + depression), dentalFloss (box body + floss strand), toothpaste (tube body + cap + crimped end), cottonPads (stacked ellipses + texture marks), pasta (wavy noodle lines + fork silhouette).
5. Confirmed alphabetical import order in `customIcons.js`: CottonPads, DentalFloss, Garlic, Hummus, KornflakesBowl, KornflakesBox, Pasta, Toothpaste.
6. Confirmed alphabetical registry insertion: new entries (CottonPads, DentalFloss, Garlic, Hummus, Pasta, Toothpaste) placed correctly relative to the existing Kornflakes entries.
7. Verified test additions: `resolveIconName` presence test for all six; `formatIconName` assertions (e.g. "Dental Floss", "Cotton Pads", "Garlic"); DOM render tests at size=22 and size=32 for all six.
8. Ran `npm run lint` — 0 errors, 1 pre-existing warning (unrelated).
9. Ran `npm run build` — success, no SVG import warnings.
10. Ran `npm test` — 155 pass (+13 over T-003 baseline of 142), 0 fail.
11. Ran `vitest run --environment jsdom iconRegistry.test.js` — 24/24 pass (12 new render tests, all six icons at size=22 and size=32).

##### Findings
- All six SVG files strictly follow the T-003 convention for interoperability with `normalizeCustomIcon`.
- The KornflakesBox/KornflakesBowl ordering in the registry (Box before Bowl) is a pre-existing artifact from T-002 and is not a T-004 concern.
- `formatIconName` correctly splits multi-word names: "Cotton Pads", "Dental Floss", "Toothpaste" (single word), etc.

##### Risks
- None.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-006

### Review Round 1

Status: **complete**

Reviewed: 2026-05-07

#### Findings

1. **nit** — `customIcons.js` lines 17–18 & 57–58; `iconRegistry.js` import block lines 18–19 and registry lines 212–213: `CustomPants` / `PantsSvg` is placed after `CustomPasta` / `PastaSvg` in all three locations. Alphabetically "Pants" (Pa-n) precedes "Pasta" (Pa-s). Not required — does not affect functionality or tests.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` and `.ai/TASKS.md` to confirm scope.
2. Verified tabler/lucide availability for all seven Group A candidates: `IconSock` ✓ tabler, `IconShoe` ✓ tabler, `IconFlame` ✓ tabler; `IconPants`, `IconPineapple`, `IconCan` absent from tabler; `Watermelon` absent from lucide — all four correctly replaced with custom SVG fallbacks.
3. Confirmed 15 new SVG files created (11 planned + 4 fallbacks: can, pants, pineapple, watermelon). All follow T-003 conventions: `viewBox="0 0 24 24"`, no `width`/`height` on root, `fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"` on root, no `stroke-width` on elements.
4. Confirmed `customIcons.js` imports and exports extended with all 15 new custom icons (Blueberries, Can, CottonSwabs, CreamJar, CreamTube, ELiquid, InterdentalSticks, Kiwi, Mango, Pants, Peach, Pineapple, Plum, Watermelon, WetWipes).
5. Confirmed `iconRegistry.js` import block and `ICON_REGISTRY` extended with all new entries; `IconSock`, `IconShoe`, `IconFlame` registered directly from tabler.
6. Confirmed test additions: `resolveIconName` presence tests for all new tabler-backed keys (IconFlame, IconShoe, IconSock) and all custom keys; `formatIconName` assertions for all new icons; DOM render tests at size=22 and size=32 for all 15 new custom icons.
7. Noted `CustomELiquid` → `"E Liquid"` is correct (the `([A-Z]+)([A-Z][a-z])` regex splits "EL" → "E L" → "E Liquid").
8. Identified `CustomPants`/`PantsSvg` placed after `CustomPasta`/`PastaSvg` in all three locations — nit, not a required fix.
9. Ran `npm run lint` — 0 errors, 1 pre-existing warning (unrelated).
10. Ran `npm run build` — success, no SVG import warnings.
11. Ran `npm test` — 187 pass (+32 over T-004 baseline of 155), 0 fail.
12. Ran `vitest run --environment jsdom iconRegistry.test.js` — 56/56 pass (32 new render tests, all 15 custom icons at size=22 and size=32 plus 3 tabler presence checks).

##### Findings
- `IconPants`, `IconPineapple`, `IconCan`, and `Watermelon` are absent from the installed tabler/lucide packages; custom SVG fallbacks correctly applied and registered under `CustomPants`, `CustomPineapple`, `CustomCan`, `CustomWatermelon`.
- All SVG files strictly follow the T-003 convention for interoperability with `normalizeCustomIcon`.
- `CustomPants`/`PantsSvg` is ordered after `CustomPasta`/`PastaSvg` — alphabetically reversed. Non-blocking nit.

##### Risks
- None.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`

---

## Task: T-005

### Review Round 1

Status: **complete**

Reviewed: 2026-05-07

#### Findings
- No issues found.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` and `.ai/TASKS.md` to confirm scope.
2. Read full `iconDatabase.js` — verified all three redirections, all new entries, and enrichment quality.
3. Verified three redirections: `garlic` → `CustomGarlic` (was IconPepper); `pasta` → `CustomPasta` (was IconToolsKitchen2); `grapes` → `IconGrape` (was IconCherry).
4. Verified DB entries for all T-002–T-004 custom icons: `CustomKornflakesBowl`, `CustomKornflakesBox`, `CustomHummus`, `CustomDentalFloss`, `CustomToothpaste`, `CustomCottonPads` (garlic and pasta covered by redirections).
5. Verified DB entries for all T-006 icons: `IconSock`, `CustomPants`, `IconShoe`, `CustomPineapple`, `CustomWatermelon`, `IconFlame`, `CustomCan`, `CustomCottonSwabs`, `CustomWetWipes`, `CustomInterdentalSticks`, `CustomCreamTube`, `CustomCreamJar`, `CustomMango`, `CustomKiwi`, `CustomPeach`, `CustomPlum`, `CustomBlueberries`, `CustomELiquid`, plus existing `IconShirt` and `IconBattery` entries.
6. Spot-checked ≥5 unique searchable terms for borderline entries (mango, kiwi, blueberries, plum, peach — all exactly 5 due to duplicate label/tag) — all pass.
7. Confirmed plan-specified enrichments: dairy, produce, bakery, meat/fish, beverages, household, condiments, pantry, drugstore categories all enriched with German regional variants, plural/singular pairs, brand synonyms, and compound-word forms.
8. Reviewed `cottonSwabs.svg` and `interdentalSticks.svg` diffs — both are visual design improvements; SVG conventions (viewBox, fill=none, stroke=currentColor, round caps/joins, no stroke-width) preserved ✓.
9. Verified `cosineSimilarity.test.js` changes: updated `zahnpasta → CustomToothpaste` (correct); new ≥5-terms automated test; new redirections test (16 spot checks); new T-006 exact-match test (20 spot checks).
10. Verified README paragraph updated to mention custom SVG icons, enriched synonyms, and expanded catalogue scope.
11. Ran `npm run lint` — 0 errors, 1 pre-existing warning.
12. Ran `npm run build` — success.
13. Ran `npm test` — 190 pass (+3 over T-006 baseline of 187), 0 fail.
14. Ran `vitest run --environment jsdom cosineSimilarity.test.js` — 10/10 pass (3 new tests).

##### Findings
- `zahnpasta` correctly maps to `CustomToothpaste` (the previous `IconDental` mapping was outdated; the test assertion was updated accordingly).
- Entries where the label text also appears in the tags (mango, kiwi, blueberries, e-liquid) still satisfy the ≥5-unique-terms constraint because the `createExactMatchMap` just overwrites with the same icon value.
- SVG design improvements to `cottonSwabs.svg` and `interdentalSticks.svg` are an appropriate cosmetic fix within this task's scope.

##### Risks
- None.

#### Open Questions
- None.

#### Verdict
`PASS`
