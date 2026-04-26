# Plan

Status: **ready_for_implement**

Goal: implement automatic icon assignment for grocery entries using local
in-browser semantic matching (transformers.js), with DB persistence, bilingual
reference data, eager model loading, and a configurable similarity threshold.

## Scope

See `ROADMAP.md` for the full decision log. The six tasks below map to the
accepted decisions.

---

## T-001 — Backend: DB migration + `icon` field in entry routes

### What
Add a nullable `icon` column (text, single emoji) to the `entries` table.
Update all entry routes to accept and return the new field.

### Files to change

| File | Change |
|------|--------|
| `backend/src/db/migrations/<ts>_add_icon_to_entries.cjs` | **new** — `pgm.addColumns('entries', { icon: { type: 'text', notNull: false } })` |
| `backend/src/routes/entries.js` | GET: add `icon` to SELECT list; POST: accept `icon` from body, add to INSERT; PATCH: accept `icon`, add to `COALESCE` update; all `RETURNING` clauses include `icon` |
| `backend/src/entries.test.js` | Extend existing tests to assert `icon` is returned; add a test for POST with icon and PATCH with icon |

### Acceptance criteria
- Migration applies and rolls back cleanly.
- `POST /api/lists/:id/entries` with `{ text, icon }` returns `entry.icon`.
- `PATCH /api/lists/:id/entries/:eid` with `{ icon }` returns updated `entry.icon`.
- `GET /api/lists/:id/entries` returns `icon` on every row (null when unset).
- Existing tests still pass; no new lint errors.

---

## T-002 — Frontend: icon reference database + utility functions

### What
Create the bilingual (EN/DE) grocery icon catalogue and the pure-JS
cosine-similarity helper. No React, no worker — just data and math that can be
unit-tested in isolation.

### Files to change

| File | Change |
|------|--------|
| `frontend/src/data/iconDatabase.js` | **new** — array of `{ label, icon, tags[] }` objects (≥ 60 entries, EN+DE); exports `ICON_DB` and `EXACT_MATCH_MAP` (lower-cased label+tag → emoji) |
| `frontend/src/utils/cosineSimilarity.js` | **new** — `cosineSimilarity(vecA, vecB): number` (pure function, no deps) |
| `frontend/src/utils/cosineSimilarity.test.js` | **new** — unit tests: identical vectors → 1.0; orthogonal → 0.0; known partial overlap |

### Icon database categories (≥ 60 entries)
Cover at minimum: dairy (Milch/milk, Käse/cheese, Butter, Joghurt/yoghurt, …),
produce (Apfel/apple, Banane/banana, Tomate/tomato, Karotte/carrot, …),
bakery (Brot/bread, Brötchen/roll, …), meat (Hähnchen/chicken, Rind/beef, …),
beverages (Wasser/water, Saft/juice, Bier/beer, Kaffee/coffee, …),
frozen (Eis/ice cream, …), snacks (Chips, Schokolade/chocolate, …),
household (Toilettenpapier/toilet paper, Waschmittel/detergent, …),
condiments (Salz/salt, Pfeffer/pepper, Öl/oil, …).

### Acceptance criteria
- `EXACT_MATCH_MAP` returns the correct emoji for known EN and DE terms.
- `cosineSimilarity` test suite passes.
- No lint errors.

---

## T-003 — Frontend: transformers.js worker + `useIconSuggestion` hook + eager init

### What
Wire up `@xenova/transformers` in a dedicated Web Worker. Expose the matching
logic through a React hook. Start the worker eagerly on app boot so the model
is warm before the first user interaction.

### Package change
Install in the frontend workspace:
```
npm install @xenova/transformers --workspace @endgame-grocery/frontend
```

### Files to change

| File | Change |
|------|--------|
| `frontend/vite.config.js` | Add `optimizeDeps: { exclude: ['@xenova/transformers'] }` so Vite does not bundle the WASM module |
| `frontend/src/workers/iconWorker.js` | **new** — Web Worker module: imports `pipeline` from `@xenova/transformers`; maintains a singleton `pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })`; pre-computes reference embeddings on first `init` message; handles `{ type: 'match', text }` messages and posts back `{ icon, score }` |
| `frontend/src/hooks/useIconSuggestion.js` | **new** — React hook; accepts `inputText: string`; fast path: exact/prefix lookup via `EXACT_MATCH_MAP` (synchronous, no worker); slow path: posts to worker, awaits embedding match; returns `{ icon: string \| null, loading: boolean }`; debounces worker calls by 300 ms |
| `frontend/src/hooks/useIconSuggestion.test.js` | **new** — unit tests with mocked worker: exact match returns immediately; empty string → null; below-threshold score → null; above-threshold → icon |
| `frontend/src/main.jsx` | Import `frontend/src/workers/iconWorker.js` via `new Worker(new URL('./workers/iconWorker.js', import.meta.url), { type: 'module' })` as a module-level side effect; store singleton reference in a shared module so the hook reuses it |

### Threshold env var
Read threshold in the worker from `import.meta.env.VITE_ICON_SIMILARITY_THRESHOLD`
with a default of `0.5`. Convert to `Number` before comparing.

### Acceptance criteria
- Worker initialises without blocking the main thread.
- `useIconSuggestion('Milch')` resolves to `🥛` (exact path).
- `useIconSuggestion('dairy product')` resolves to a plausible dairy icon via
  embedding within the debounce window (integration; can be skipped in unit
  tests where the worker is mocked).
- `useIconSuggestion('')` returns `{ icon: null, loading: false }`.
- Score below threshold → `icon: null`.
- No lint errors.

---

## T-004 — Frontend UI: `AddItemSheet` live preview + API/page wiring

### What
Show the resolved icon as a badge in the Add-Item form. Carry the icon through
the `onAdd` callback, the API call, and the optimistic local state.

### Files to change

| File | Change |
|------|--------|
| `frontend/src/components/AddItemSheet.jsx` | Use `useIconSuggestion(text)` hook; render the emoji badge (or spinner if `loading`) next to the input label; call `onAdd(trimmed, icon)` (second argument added) |
| `frontend/src/api/entries.js` | `createEntry(listId, token, { text, icon }, options)` — pass `icon` in payload (already forwarded if present) |
| `frontend/src/pages/ListDetailPage.jsx` | `addEntryByText(text, icon)` — accept icon param; include `icon` in `temporaryEntry` and `createEntry` call |

### UI detail
The badge appears below/beside the input as a large emoji (1.5 rem) inside a
rounded pill. While `loading === true` show a small animated spinner in its
place. If `icon === null` show nothing (no placeholder in the sheet, only
fallback in EntryRow).

### Acceptance criteria
- Typing "Milch" in the sheet shows `🥛` within ≤ 300 ms (exact-match path).
- Submitting the form passes the resolved icon to `createEntry`.
- `onAdd` signature change is reflected in `ListDetailPage`.
- No lint errors.

---

## T-005 — Frontend UI: `EntryRow` icon display

### What
Render the persisted `entry.icon` to the left of the item text. Fall back to
`🛒` when the field is absent.

### Files to change

| File | Change |
|------|--------|
| `frontend/src/components/EntryRow.jsx` | Add an `<span aria-hidden="true" className="entry-icon">{ entry.icon ?? '🛒' }</span>` before the `entry-row-copy` div; apply `entry-row-done` opacity to the icon span when status is done |
| `frontend/src/components/entry-row.test.jsx` | Add a test: entry with `icon: '🥛'` renders the emoji; entry without `icon` renders `🛒` |

### Acceptance criteria
- EntryRow renders the correct emoji when `entry.icon` is set.
- EntryRow renders `🛒` when `entry.icon` is null/undefined.
- Swipe-delete test still passes.
- No lint errors.

---

## T-006 — Configuration + documentation

### What
Expose the similarity threshold as a configurable env var and document it.

### Files to change

| File | Change |
|------|--------|
| `.env.example` | Add `VITE_ICON_SIMILARITY_THRESHOLD=0.5` with a comment explaining the range (0–1) |
| `Dockerfile` | Add `ARG VITE_ICON_SIMILARITY_THRESHOLD=0.5` before the `RUN npm run build --workspace frontend` step; set it as `ENV VITE_ICON_SIMILARITY_THRESHOLD=$VITE_ICON_SIMILARITY_THRESHOLD` so Vite picks it up |
| `docker-compose.example.yml` | Add a `build` section to the `app` service with `args: [VITE_ICON_SIMILARITY_THRESHOLD=0.5]` and a comment noting this only applies when building locally, not when pulling a pre-built image |
| `README.md` | Add `VITE_ICON_SIMILARITY_THRESHOLD` row to the env-var table; add a brief "Icon Assignment" subsection under a new "Features" heading (or existing equivalent) explaining the local-AI approach and the threshold |

### Acceptance criteria
- `.env.example` contains the new var.
- Dockerfile builds without errors when the build arg is overridden.
- README env table lists the new var with description and example.
- No lint errors; `npm run build` succeeds.

---

---

## T-007 — Frontend: install Tabler Icons + refactor icon database to icon names

### Context
T-001–T-005 are committed and use emoji strings in the `icon` field. T-007–T-010
replace that approach with Tabler SVG icon components. The DB column type (`text`)
stays the same; the stored value changes semantics from an emoji character to a
Tabler component name (e.g. `"IconMilk"`). Existing DB rows with emoji values
will fall back to `IconShoppingCart` at render time — no migration needed.

### What
Install `@tabler/icons-react`, create a curated icon registry (only the icons
actually referenced in the database, ensuring tree-shaking), and update the
icon database so `icon` fields hold Tabler component name strings.

### Package change
```
npm install @tabler/icons-react --workspace @endgame-grocery/frontend
```

### Files to change

| File | Change |
|------|--------|
| `frontend/src/data/iconRegistry.js` | **new** — named imports from `@tabler/icons-react` for all food-relevant icons (target: 50–80); exports `ICON_REGISTRY: Record<string, ComponentType>`, `ICON_REGISTRY_KEYS: string[]` (ordered list for the picker grid), and `FALLBACK_ICON` (`IconShoppingCart`) |
| `frontend/src/data/iconDatabase.js` | Replace every `icon: "🥛"` (emoji) with the matching Tabler name string `icon: "IconMilk"`; update `EXACT_MATCH_MAP` accordingly; categories and tags stay bilingual |

### Tabler icon name guidance — expanded set (~80–110 icons)
The implementer must verify all names against the installed package; build will
fail on a bad import. Broad categories and representative confirmed names
(Tabler v3) to target:

| Category | Icons |
|----------|-------|
| Dairy | `IconMilk`, `IconCheese`, `IconEgg`, `IconBottle` (cream) |
| Produce | `IconApple`, `IconCarrot`, `IconBanana`, `IconGrapes`, `IconLemon`, `IconCherry`, `IconPepper`, `IconMushroom`, `IconPumpkin` |
| Salad/herbs | `IconSalad`, `IconLeaf` |
| Bakery | `IconBread`, `IconCroissant` |
| Meat/Fish | `IconFish`, `IconMeat`, `IconBacon`, `IconDrumstick` |
| Beverages | `IconCoffee`, `IconBeer`, `IconWine`, `IconGlass`, `IconDroplet`, `IconJuice` |
| Prepared food | `IconPizza`, `IconSoup`, `IconBurger`, `IconHotdog`, `IconNoodles` |
| Snacks/sweets | `IconCookie`, `IconCandy`, `IconIceCream2`, `IconCake`, `IconPopcorn`, `IconChocolate` |
| Pantry/condiments | `IconSalt`, `IconJar`, `IconBottle` (oil) |
| Frozen | `IconSnowflake` |
| **Haushalt** | `IconSpray` (Reiniger), `IconToiletPaper`, `IconHanger` (Wäsche), `IconWashMachine` (Waschmittel), `IconBroom` (Reinigung), `IconTrash` (Müllbeutel), `IconBucket`, `IconBattery`, `IconBulb` (Glühbirnen), `IconToolsKitchen2` (Küchenhelfer), `IconSoap` |
| **Drogerie** | `IconPill` (Medikamente), `IconFirstAidKit`, `IconBandage`, `IconDental` (Zahnpflege), `IconRazor` (Rasierer), `IconFlask` (Kosmetik/Pflege), `IconThermometer`, `IconScissors` (Nagelpflege), `IconSun` (Sonnenschutz), `IconBabyBottle` (Babypflege), `IconEye` (Kontaktlinsen) |
| Fallback | `IconShoppingCart` |

The `iconDatabase.js` bilingual entry list should be extended with EN/DE terms
for the new household and drugstore entries so the semantic search covers them.
For items without a precise match use the nearest thematic icon. All names are
suggestions — verify against actual package exports before use.

### Acceptance criteria
- `npm install` succeeds; `@tabler/icons-react` appears in `frontend/package.json`.
- `ICON_REGISTRY` contains ≥ 80 entries covering all categories above (food, household, drugstore).
- `ICON_REGISTRY_KEYS` is a non-empty array of the same keys (used by the picker grid).
- Every icon name in `ICON_DB` exists in `ICON_REGISTRY` (no dangling references).
- `ICON_DB` includes bilingual EN/DE entries for household and drugstore items.
- `EXACT_MATCH_MAP["milch"]` returns `"IconMilk"` and `EXACT_MATCH_MAP["toilettenpapier"]` returns `"IconToiletPaper"` (strings, not emojis).
- `npm run build` passes (tree-shaking: only registered icons bundled).
- `npm run lint` passes; `npm test` passes (cosineSimilarity tests still green).

---

## T-008 — Frontend: update worker + hook to return icon name and top matches

### What
The worker currently returns a single `{ icon, score }` (emoji). Update it to
return `{ iconName, score, topMatches }` where `topMatches` is an array of the
top-N icon names by similarity for the inline picker. Update the client and hook
accordingly.

### Files to change

| File | Change |
|------|--------|
| `frontend/src/workers/iconWorker.js` | `matchResult` message payload: rename `icon` → `iconName`; add `topMatches: Array<{ iconName: string, score: number }>` (top 5 entries with score ≥ 0.25, sorted descending); reference embeddings use Tabler icon names from updated `ICON_DB` |
| `frontend/src/workers/iconWorkerClient.js` | `handleWorkerMessage`: destructure `iconName` and `topMatches` from `event.data`; `requestIconMatch` resolves with `{ iconName, score, topMatches }` |
| `frontend/src/hooks/useIconSuggestion.js` | Return type changes to `{ iconName: string \| null, topMatches: string[], loading: boolean }`; exact-match fast path: `topMatches: []` (unambiguous — no picker needed); async path: `topMatches` from worker result; rename internal `icon` state to `iconName` |
| `frontend/src/hooks/useIconSuggestion.test.js` | Update all assertions: `icon` → `iconName`; add case asserting `topMatches` is an array; mock worker resolves with `{ iconName, score, topMatches }` |

### Acceptance criteria
- `useIconSuggestion("milch")` returns `{ iconName: "IconMilk", topMatches: [], loading: false }`.
- `useIconSuggestion("")` returns `{ iconName: null, topMatches: [], loading: false }`.
- Async path returns `topMatches` with at most 5 entries, each a string.
- Below-threshold score → `iconName: null`, `topMatches: []`.
- Hook unit tests pass; lint clean.

---

## T-011 — Frontend: `IconPickerSheet` component (shared full-catalogue picker)

### What
A reusable bottom sheet that shows the complete icon registry as a scrollable
grid. Used by both `AddItemSheet` ("Mehr anzeigen" button) and `EntryRow` edit
mode. The currently-selected icon is highlighted; tapping any icon fires
`onSelect(iconName)` and closes the sheet.

### Files to change

| File | Change |
|------|--------|
| `frontend/src/components/IconPickerSheet.jsx` | **new** — `IconPickerSheet({ open, selectedIconName, onSelect, onClose })`; renders a `BottomSheet` with a search `<input>` (filters icon names case-insensitively against `ICON_REGISTRY_KEYS`) and a CSS grid of icon buttons; tapping a button calls `onSelect(iconName)` then `onClose()`; selected icon gets a highlight class |
| `frontend/src/components/IconPickerSheet.test.jsx` | **new** — renders the sheet, asserts grid contains icons; search filters the list; tapping an icon fires `onSelect`; selected icon has highlight class |
| `frontend/src/index.css` | Add `.icon-picker-grid` (CSS grid, auto-fill columns), `.icon-picker-btn` (square, borderless, hover/active state), `.icon-picker-btn--selected` (highlight), `.icon-picker-search` (full-width input) styles |

### Acceptance criteria
- All icons from `ICON_REGISTRY_KEYS` render in the grid when search is empty.
- Typing in the search field hides non-matching icons.
- Tapping an icon fires `onSelect` with the correct icon name.
- Sheet closes after selection.
- Selected icon has a visible highlight.
- `IconPickerSheet` test suite passes; lint clean.

---

## T-009 — Frontend UI: inline icon picker in `AddItemSheet`

### What
Replace the single emoji-badge preview with a Tabler SVG icon preview plus an
inline row of alternative icon suggestions (top matches). Add a "Mehr anzeigen"
button that opens `IconPickerSheet` for manual full-catalogue selection.

### Files to change

| File | Change |
|------|--------|
| `frontend/src/components/AddItemSheet.jsx` | Use `useIconSuggestion(text)` new return type; maintain `selectedIconName` local state (resets when `iconName` from hook changes); `showFullPicker` boolean state for `IconPickerSheet` open/close; render selected icon as large SVG preview via `ICON_REGISTRY`; render `topMatches` alternatives as small tappable buttons in a row; add "Mehr anzeigen" button (icon: `IconDotsCircleHorizontal` or similar) that sets `showFullPicker = true`; `<IconPickerSheet>` wired to `showFullPicker`, `selectedIconName`, and `onSelect`; `onAdd(trimmed, selectedIconName)` |
| `frontend/src/components/AddItemSheet.test.jsx` | Update tests: SVG preview renders; alternatives row visible when `topMatches > 1`; tapping alternative updates selected; "Mehr anzeigen" button opens `IconPickerSheet`; selecting from full picker updates preview |
| `frontend/src/index.css` | Add `.add-item-icon-picker` row styles (flex, gap) and `.add-item-icon-picker-btn` button styles (borderless, rounded, selected highlight) |

### UI behaviour detail
- **Loading**: spinner (unchanged).
- **Exact match**: large SVG preview only; no alternatives row; "Mehr anzeigen" always visible.
- **Semantic matches** (`topMatches.length > 0`): preview + alternatives row + "Mehr anzeigen".
- **No match** (`iconName === null`): no preview, no alternatives row; "Mehr anzeigen" still visible so user can pick manually.
- `selectedIconName` resets to `iconName` whenever the hook delivers a new best guess.
- After `IconPickerSheet` selection, `selectedIconName` holds the manually chosen name (no longer tracks hook).

### Acceptance criteria
- Typing "Milch" shows `<IconMilk />` SVG preview.
- Typing "Gemüse" shows SVG preview + alternatives row.
- "Mehr anzeigen" opens `IconPickerSheet` in all states.
- Selecting from `IconPickerSheet` updates the preview.
- Submitting passes `selectedIconName` to `onAdd`.
- Tests pass; lint clean.

---

## T-010 — Frontend UI: `EntryRow` SVG icon display + edit-mode icon picker

### What
Replace the emoji `<span>` in `EntryRow` with a Tabler SVG component. Extend
the existing edit mode with an inline icon picker row (same visual style as
`AddItemSheet`) and a "Mehr anzeigen" button that opens `IconPickerSheet`.

### Files to change

| File | Change |
|------|--------|
| `frontend/src/components/EntryRow.jsx` | **View mode**: compute `const EntryIcon = ICON_REGISTRY[entry.icon] ?? FALLBACK_ICON`; replace emoji span with `<EntryIcon aria-hidden size={22} stroke={1.5} className="entry-icon" />`; apply done-state opacity. **Edit mode**: add `selectedIconName` state (initialised to `entry.icon ?? null`); render the current icon as a large preview button above/beside the text input; add a horizontal row of all `ICON_REGISTRY_KEYS` icons as small tappable buttons (scrollable, same `.add-item-icon-picker` CSS class); add "Mehr anzeigen" button opening `IconPickerSheet`; pass `selectedIconName` to `onEdit(trimmed, selectedIconName)` — **second argument added** |
| `frontend/src/components/entry-row.test.jsx` | Update existing icon tests to check SVG presence; add tests for edit-mode: icon row renders, tapping an icon updates selection, "Mehr anzeigen" opens `IconPickerSheet` |
| `frontend/src/pages/ListDetailPage.jsx` | `submitEditEntry(entryId, text, iconName)` — add `iconName` param; include in `updateEntry` payload |
| `frontend/src/api/entries.js` | `updateEntry` payload already forwards arbitrary fields — confirm `icon` is passed through (no structural change expected, verify only) |

### Acceptance criteria
- View mode: EntryRow with `icon: "IconMilk"` renders `<svg>`; null/unknown → fallback SVG.
- Edit mode: icon picker row visible with all registry icons.
- Edit mode: tapping an icon updates the preview.
- Edit mode: "Mehr anzeigen" opens `IconPickerSheet`.
- Saving passes updated icon name to `onEdit`.
- All existing entry-row tests pass; new edit-mode tests pass.
- Lint clean; `npm run build` passes.

---

---

## T-012 — Frontend: dual-library icon registry (Tabler primary + Lucide fallback) + `AddItemSheet` edit-mode + inline icon browser

### Context
T-009 and T-011 are committed. T-012 adds three concerns:
1. **Dual-library registry**: Tabler Icons is primary; Lucide React fills gaps where
   Tabler has no matching icon (e.g. `Banana`). A prop-normalization wrapper
   eliminates the `stroke` vs. `strokeWidth` API difference between the two libraries.
2. **"Mehr anzeigen" inline**: expands the icon browser within the same sheet
   instead of opening `IconPickerSheet` as a second bottom sheet.
3. **Edit mode**: `AddItemSheet` accepts `initialText`/`initialIconName`/`mode`
   props so it can be reused for editing existing entries.

### Package change
```
npm install lucide-react --workspace @endgame-grocery/frontend
```

### Prop-normalization design
Tabler icons use `stroke={number}` for stroke width; Lucide icons use
`strokeWidth={number}`. To keep rendering code uniform, every Lucide icon stored
in `ICON_REGISTRY` is wrapped at registration time:

```js
// frontend/src/data/iconRegistry.js
function fromLucide(LucideIcon) {
  return function NormalizedIcon({ stroke, strokeWidth, ...rest }) {
    return <LucideIcon strokeWidth={stroke ?? strokeWidth ?? 1.5} {...rest} />;
  };
}
// Usage:
import { Banana } from 'lucide-react';
const registry = {
  // Tabler (no wrapper needed — already accept `stroke`):
  IconMilk,
  // Lucide (wrapped):
  Banana: fromLucide(Banana),
};
```

All callers render icons with `<Icon size={22} stroke={1.5} />` regardless of
source library.

### Files to change

| File | Change |
|------|--------|
| `frontend/src/data/iconRegistry.js` | Install-and-replace: (1) add `lucide-react` imports for icons where Tabler has no equivalent; (2) add `fromLucide()` wrapper factory (see above); (3) wrap every Lucide import with `fromLucide`; (4) merge Tabler and Lucide entries into one `ICON_REGISTRY` object; (5) update `ICON_REGISTRY_KEYS`; (6) fix any dangling Tabler imports that do not exist in the installed package (banana, etc.) |
| `frontend/src/data/iconDatabase.js` | Fix banana entry: set `icon` to whichever name is used in the updated registry (`"IconBanana"` if Tabler has it, or `"Banana"` from Lucide if not); add or fix any other entries whose icon name has no registry match |

Lucide icons to add (representative — implementer verifies availability):

| Gap | Lucide icon name |
|-----|-----------------|
| Banana | `Banana` |
| Croissant | `Croissant` (if not in Tabler) |
| Sandwich | `Sandwich` |
| Milk bottle | `MilkOff` / `Milk` (if Tabler `IconMilk` insufficient) |
| Nut/Peanut | `Nut` |
| Citrus/Orange | `Citrus` |
| Leaf/herb | `Leaf` (if Tabler `IconLeaf` missing) |
| Cherry | `Cherry` (if Tabler `IconCherry` missing) |
| Grape | `Grape` (if Tabler `IconGrapes` missing) |
| Beef | `Beef` |
| Egg | `Egg` (if Tabler `IconEgg` missing) |
| Pill | `Pill` (if Tabler `IconPill` missing) |
| Scissors | `Scissors` (if Tabler `IconScissors` missing) |
| Trash | `Trash2` (if Tabler `IconTrash` missing) |

The implementer checks each Tabler name first; only use the Lucide alternative if the Tabler name cannot be imported without a build error.

| File | Change |
|------|--------|
| `frontend/src/components/AddItemSheet.jsx` | Add props: `initialText` (default `""`), `initialIconName` (default `null`), `mode` (`'add'` \| `'edit'`, default `'add'`); title = "Add Item" / "Edit Item", submit button = "Add Item" / "Save Item" based on `mode`; initialise `text` and `selectedIconName` from `initialText`/`initialIconName` on open; add `showIconBrowser` boolean state; when `false` render normal form (input + suggestions row + "Mehr anzeigen" button); when `true` render inline icon browser: search `<input>` + scrollable grid of all `ICON_REGISTRY_KEYS` icons filtered case-insensitively by icon name, "Zurück" button returns to form; selected icon highlighted; tapping a grid icon sets `selectedIconName` and collapses browser; remove `<IconPickerSheet>` import and usage |
| `frontend/src/components/AddItemSheet.test.jsx` | Update tests: edit mode pre-fills text and icon; "Mehr anzeigen" expands inline browser (no second sheet); search filters icons; selecting from browser updates preview and collapses browser; add mode still works; submit passes correct icon |
| `frontend/src/index.css` | Add `.add-item-icon-browser` section styles (max-height, overflow-y: auto, smooth transition); `.add-item-icon-browser-grid` (CSS grid, auto-fill small columns); `.add-item-icon-browser-btn` (square, borderless, selected highlight) |

### UI behaviour detail
- **Icon browser collapsed** (default): input + top-matches row + "Mehr anzeigen" button visible.
- **Icon browser expanded**: search input + scrollable icon grid (Tabler + Lucide entries combined); "Zurück" collapses back without losing `selectedIconName`; sheet stays open.
- On sheet close or submit, `showIconBrowser` resets to `false`.

### Acceptance criteria
- `lucide-react` appears in `frontend/package.json`; `npm run build` passes with both libraries tree-shaken.
- Typing "Banane" or "banana" shows a banana icon (not the fallback cart).
- All icons in `ICON_REGISTRY` render with a consistent `stroke` prop — no prop-mismatch warnings in the console.
- `mode="add"` (default) behaves identically to previous T-009 behaviour except "Mehr anzeigen" expands inline.
- `mode="edit"` with `initialText="Milch"` + `initialIconName="IconMilk"` pre-fills input and shows `<IconMilk />` immediately.
- Tapping "Mehr anzeigen" reveals inline icon grid; no second bottom sheet opens.
- Typing in the icon search narrows the grid.
- Tapping a grid icon updates the preview and collapses the browser.
- Submit passes `selectedIconName` via `onAdd`.
- `AddItemSheet` test suite passes; lint clean; no `IconPickerSheet` import.

---

## T-013 — Frontend: `EntryRow` inline-edit removal + edit-via-sheet wiring + `IconPickerSheet` deletion

### Context
T-010 added an inline edit form with icon picker to `EntryRow`. That form is
now replaced: the edit button opens the refactored `AddItemSheet` (in edit
mode) managed by `ListDetailPage`. `IconPickerSheet` is no longer used anywhere
and must be deleted.

### Files to change

| File | Change |
|------|--------|
| `frontend/src/components/EntryRow.jsx` | **Remove** all inline-edit state and JSX (`editMode`, `editText`, `cancelEdit`, `submitEdit`, inline form, `onKeyDown` handlers, icon picker row, "Mehr anzeigen" in edit mode); edit button `onClick` calls `onEdit()` with **no arguments** (signals intent to edit — `ListDetailPage` handles the rest); view-mode SVG icon rendering from T-010 stays unchanged |
| `frontend/src/components/entry-row.test.jsx` | Remove all inline-edit tests; keep view-mode SVG icon tests and swipe-delete test; add test: tapping edit button calls `onEdit` |
| `frontend/src/pages/ListDetailPage.jsx` | Add `editingEntry` state (null \| entry object); wire `<EntryRow onEdit={() => setEditingEntry(entry)} />`; render a second `<AddItemSheet mode="edit" initialText={editingEntry?.text ?? ""} initialIconName={editingEntry?.icon ?? null} open={!!editingEntry} onAdd={(text, icon) => { void submitEditEntry(editingEntry.id, text, icon); setEditingEntry(null); }} onClose={() => setEditingEntry(null)} />`; `submitEditEntry(entryId, text, iconName)` signature unchanged from T-010 |
| `frontend/src/components/IconPickerSheet.jsx` | **Delete** |
| `frontend/src/components/IconPickerSheet.test.jsx` | **Delete** |

### Acceptance criteria
- `EntryRow` has no inline edit form; the component is simpler.
- Tapping the edit button on a list item opens `AddItemSheet` in edit mode pre-filled with the item's text and icon.
- Submitting the edit sheet calls `updateEntry` with updated text and icon.
- Closing the edit sheet without submitting does not change the entry.
- `IconPickerSheet.jsx` and `IconPickerSheet.test.jsx` no longer exist in the repo.
- All entry-row tests pass; `npm test` passes; lint clean; `npm run build` passes.

---

---

## T-014 — Frontend: "Mehr anzeigen" icon browser as inline accordion (no view-swap)

### Context
T-012 implemented "Mehr anzeigen" as a **view-swap**: the form hides when the
icon browser opens, and a "Zurück" button swaps back. The intended UX is
different: the icon browser should expand **below** the "Mehr anzeigen" button
as an accordion — the form (input, suggestion row, button) stays fully visible
above, and the browser section appears beneath it within the same scrollable
sheet.

### What
Replace the toggle-view pattern with an accordion/expand-below pattern:
- `showIconBrowser` state remains, but instead of hiding the form it controls
  the visibility of a collapsible section below the button.
- The "Mehr anzeigen" / "Weniger anzeigen" button label toggles; no separate
  "Zurück" button is needed.
- The BottomSheet body scrolls naturally when both form and browser are visible.

### Files to change

| File | Change |
|------|--------|
| `frontend/src/components/AddItemSheet.jsx` | Remove the form/browser view-swap (`showIconBrowser ? <browser> : <form>`); render the full form always; render the icon browser section conditionally **below** the "Mehr anzeigen" button (`{showIconBrowser && <div className="add-item-icon-browser">…</div>}`); change button label: "Mehr anzeigen" when collapsed, "Weniger anzeigen" when expanded; remove "Zurück" button |
| `frontend/src/components/AddItemSheet.test.jsx` | Update tests: form elements (input, submit button) remain in the DOM when the browser is expanded; "Mehr anzeigen" toggles to "Weniger anzeigen" after tap; browser section mounts below the form, not instead of it |
| `frontend/src/index.css` | Adjust `.add-item-icon-browser` — remove any `position: absolute` / full-height override that was used for the view-swap; ensure the section flows naturally in the document and the sheet body is `overflow-y: auto` |

### Acceptance criteria
- Tapping "Mehr anzeigen" expands the icon browser **below** the button; the
  input, suggestion row, and "Mehr/Weniger anzeigen" button remain visible above.
- The sheet body scrolls when both form and full icon grid are visible.
- The button label reads "Weniger anzeigen" while the browser is open.
- Tapping "Weniger anzeigen" collapses the browser; form-only layout restored.
- Selecting an icon from the grid still updates `selectedIconName` and collapses
  the browser (label returns to "Mehr anzeigen").
- `AddItemSheet` tests pass; lint clean; `npm run build` passes.

---

---

## T-015 — Frontend: fix double scrollbar when icon browser is expanded

### Context
T-014 renders the icon browser as an accordion below the form within
`.bottom-sheet` (which already has `overflow-y: auto`). When the browser
expands, `.add-item-icon-browser-grid` also has `overflow-y: auto`, causing
two simultaneous scrollbars. Only the icon grid should scroll; the outer sheet
must not.

### Root cause
`.bottom-sheet { overflow-y: auto }` scrolls the whole sheet when content
exceeds `max-height: min(80vh, 44rem)`. The grid inside also scrolls because it
has its own `max-height` + `overflow-y: auto`. Result: two scrollbars.

### Fix strategy — flex layout with `overflow: hidden` on the sheet
When the icon browser is open, switch the sheet to a flex column that fills the
available height. The form is `flex-shrink: 0`; the browser section grows to
fill the rest with `flex: 1; overflow: hidden`; only the grid inside it scrolls.
A modifier class `.bottom-sheet--browser-open` (toggled by `AddItemSheet` via
a `className` prop on `BottomSheet`, or directly on the wrapping element) drives
the layout change.

### Files to change

| File | Change |
|------|--------|
| `frontend/src/index.css` | Add `.bottom-sheet--browser-open { overflow: hidden; display: flex; flex-direction: column; }` — disables outer scroll and enables flex; add `.bottom-sheet--browser-open .add-item-form { flex-shrink: 0; }` — form takes only the space it needs; add `.bottom-sheet--browser-open .add-item-icon-browser { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }` — browser section fills remaining height; change `.bottom-sheet--browser-open .add-item-icon-browser-grid { flex: 1; max-height: none; overflow-y: auto; }` — grid is the sole scrolling element |
| `frontend/src/components/AddItemSheet.jsx` | Pass `className` (or equivalent prop) to `BottomSheet` when `showIconBrowser` is `true` so the modifier class is applied: e.g. `<BottomSheet className={showIconBrowser ? "bottom-sheet--browser-open" : ""} …>` |
| `frontend/src/components/ui/BottomSheet.jsx` | Accept and forward a `className` prop onto the `.bottom-sheet` `<div>` if not already supported |
| `frontend/src/components/AddItemSheet.test.jsx` | Add test: when browser is expanded, the sheet element has the modifier class; confirm only one scrollable container (the grid) is present |

### Acceptance criteria
- Opening the icon browser shows **one** scrollbar (on the icon grid only).
- The outer sheet does **not** display a scrollbar while the browser is open.
- The form (input, suggestions, "Mehr/Weniger anzeigen" button) remains fully visible and non-scrolling above the grid.
- Closing the browser restores normal sheet scroll behaviour.
- `npm run lint` and `npm test` pass; `npm run build` succeeds.

---

## Implementation Order (final)

```
[done]  T-001 → T-002 → T-003 → T-004 → T-005
[done]  T-007 → T-008 → T-011 → T-009 → T-010 → T-006
[done]  T-012 → T-013
[done]  T-014
[next]  T-015
          ↑
      double-scrollbar
      CSS fix
```

Each task is independently committable. The implementer should run
`npm run lint && npm run build && npm test` after every task.

## Validation

After all tasks are complete:
- `npm run lint` — zero errors; no `IconPickerSheet` imports remain
- `npm run build` — clean build; only registered Tabler icons bundled
- `npm test` — all backend + frontend unit tests pass
- Manual smoke:
  - Add item: type "Milch" → `<IconMilk />` preview; tap "Mehr anzeigen" → inline grid expands; tap icon → preview updates; submit → row shows selected icon.
  - Edit item: tap edit button on existing row → same sheet opens pre-filled; change text/icon; save → row updates.
  - No second bottom sheet ever opens for icon selection.
