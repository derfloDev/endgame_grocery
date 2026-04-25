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

## Implementation Order

```
T-001  →  T-002  →  T-003  →  T-004  →  T-005  →  T-006
  ↑          ↑          ↑          ↑          ↑
backend   data/math   worker    UI sheet   UI row   config
```

Each task is independently committable. The implementer should run
`npm run lint && npm run build && npm test` after every task.

## Validation

After all tasks are complete:
- `npm run lint` — zero errors
- `npm run build` — frontend bundle produced without warnings on tree-shaking
- `npm test` — all backend + frontend unit tests pass
- Manual smoke: open Add-Item sheet, type "Milch" → `🥛` appears; submit → item
  shows `🥛` in list.
