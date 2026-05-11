# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

---

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-11

#### Findings

No issues found.

#### Verification

##### Steps

1. Read `.ai/TASKS.md` — T-001 moved to `in_review`.
2. Read `.ai/PLAN.md` — implementation requirements confirmed: substring-match third pass in `getExactOrPrefixIcon`, minimum length guard of 4, longest-match wins, 2 new tests asserting no worker call.
3. Read `frontend/src/hooks/useIconSuggestion.js` — implementation reviewed against plan.
4. Read `frontend/src/hooks/useIconSuggestion.test.js` — new tests reviewed against acceptance criteria.
5. Verified `EXACT_MATCH_MAP` key construction in `iconDatabase.js`: `toLookupKey` = `trim().toLowerCase()`, so "möhren" → key "möhren" (IconCarrot) and "paprika" → key "paprika" (CustomBellPepper). Compound-word assertions are grounded in real data.
6. `npm run lint` — PASS (1 pre-existing Fast Refresh warning in `AuthContext.jsx`, unrelated to T-001).
7. `npm run build` — PASS (pre-existing bundle/eval warnings only).
8. `npx vitest run --environment jsdom useIconSuggestion` — 7/7 tests PASS including both new compound-word tests.
9. Full test suite `npx vitest run --environment jsdom` — 272/272 tests PASS, 23 test files, no regressions.

##### Findings

- Implementation matches the plan exactly: substring-match loop added after exact and prefix passes, `term.length >= 4` guard present, longest-match selection via `term.length > bestSubstringLength`.
- Both acceptance-criteria cases pass: `useIconSuggestion("Spritzpaprika")` → `CustomBellPepper` (sync, no worker), `useIconSuggestion("Minimöhren")` → `IconCarrot` (sync, no worker).
- Existing tests unaffected.
- Lint and build clean relative to this change.

##### Risks

- None. The substring scan iterates `EXACT_MATCH_MAP` (frozen object); cost is proportional to the number of entries and runs only when exact-match and prefix checks both miss — negligible for interactive input.

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-11

#### Findings

No issues found.

- **nit** — `cucumber.svg` sets `stroke-width="1.5"` explicitly on the root element, while `bellPepper.svg` and `tomato.svg` omit this attribute (inheriting the SVG default of 1 when rendered standalone). The plan explicitly requires `stroke-width="1.5"`, so the implementation is correct per spec. Pre-existing inconsistency in the reference icons; not a required fix.

#### Verification

##### Steps

1. Read `frontend/src/assets/icons/custom/cucumber.svg` — SVG reviewed in full.
2. Read `bellPepper.svg` and `tomato.svg` — compared root SVG attributes and path count for visual weight.
3. Verified `customIcons.js` already imports and exports `CustomCucumber` from `cucumber.svg?react` — no registry changes needed.
4. Verified `iconDatabase.js` already registers `CustomCucumber` with tags "gurke", "gurken", etc. — no database changes needed.
5. Confirmed no `fill` attributes on any `<path>` — only `fill="none"` on root element.
6. `npx eslint .` — PASS (1 pre-existing Fast Refresh warning in `AuthContext.jsx`, unrelated to T-002).
7. `npx vite build` — PASS (pre-existing ONNX eval and chunk-size warnings only).
8. `npx vitest run --environment jsdom` — 272/272 tests PASS, no regressions.

##### Findings

- All required SVG attributes present: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.5"`, `stroke-linecap="round"`, `stroke-linejoin="round"`. ✓
- No hardcoded colours on root or any path. ✓
- Five paths: 1 diagonal closed body shape, 1 short stem nub at the narrow (top-right) end, 3 short diagonal texture strokes evenly spaced across the body. Satisfies "diagonal body, stem nub, 2–3 texture lines". ✓
- Icon is already registered as `CustomCucumber` — no JS, registry, or test-file changes were needed or made. ✓
- Lint and build clean relative to this change.

##### Risks

- None. Pure SVG asset replacement; no logic paths affected.
