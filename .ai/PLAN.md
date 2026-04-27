# Plan

Status: **ready_for_implement**

Goal: deliver smart autocomplete in the Add Item sheet — ranked product suggestions from per-list backend history, with offline cache fallback.

## Scope

See `ROADMAP.md` for full acceptance criteria and design decisions. Summary:

- DB table `autocomplete_history` tracks per-user-per-list item usage frequency.
- `POST /entries` upserts history on every successful item creation.
- `GET /api/lists/:id/suggestions?q=<query>` returns ≤ 5 ranked, fuzzy-matched suggestions.
- Frontend hook `useAutocomplete` debounces the API call, caches results in IndexedDB, and applies client-side fuzzy filtering when offline.
- New `AutocompleteSuggestions` component renders icon + label chips (≥ 44 px tap target).
- `AddItemSheet` renders the chip list below the text input; tapping a chip calls `onAdd(text, iconName)` directly — no extra confirmation, sheet stays open.

## Task Dependency Order

```
T-001  →  T-002  →  T-003  →  T-004
(migration) (backend)  (hook)   (UI)
```

T-003 and T-004 may be started in parallel once T-002 is merged, but T-004 depends on the shape exported by T-003.

---

## T-001 — DB Migration: `autocomplete_history`

### What
New node-postgres-migrate migration file that creates the `autocomplete_history` table and enables the `pg_trgm` extension used by T-002 for fuzzy matching.

### Schema

```sql
-- Extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE autocomplete_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  list_id      UUID        NOT NULL REFERENCES lists(id)  ON DELETE CASCADE,
  text         TEXT        NOT NULL,
  icon         TEXT,
  use_count    INTEGER     NOT NULL DEFAULT 1,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce one row per user+list+text combination
ALTER TABLE autocomplete_history
  ADD CONSTRAINT autocomplete_history_user_list_text_key
  UNIQUE (user_id, list_id, text);

-- Fast lookup by user + list
CREATE INDEX autocomplete_history_user_list_idx
  ON autocomplete_history (user_id, list_id);
```

### Files to change
- `backend/src/db/migrations/<timestamp>_add_autocomplete_history.cjs` — **new**

### Acceptance Criteria
- Migration runs `up` without error against a fresh DB (existing migration tests pass).
- `down` cleanly drops the table, index, and extension (if no other tables use it).
- `npm run lint` passes.
- `npm run build` passes.

---

## T-002 — Backend: Suggestions Endpoint + Entry Upsert

### What
Two backend changes wired together:
1. **Upsert** into `autocomplete_history` whenever `POST /api/lists/:id/entries` succeeds.
2. **New route** `GET /api/lists/:id/suggestions?q=<query>` that queries `autocomplete_history` with fuzzy matching and returns ≤ 5 ranked results.

### Upsert Logic (entries route)

After a successful `INSERT INTO entries …`, execute:

```sql
INSERT INTO autocomplete_history (user_id, list_id, text, icon, use_count, last_used_at)
VALUES ($1, $2, $3, $4, 1, NOW())
ON CONFLICT (user_id, list_id, text)
DO UPDATE SET
  icon         = EXCLUDED.icon,
  use_count    = autocomplete_history.use_count + 1,
  last_used_at = NOW();
```

- `user_id` = `req.user.sub`
- `list_id` = `req.params.id`
- `text` = `text.trim()` (same normalisation as the entry)
- `icon` = `icon ?? null`

### Suggestions Endpoint

`GET /api/lists/:id/suggestions?q=<query>`

- Requires auth (same `requireAuth` middleware).
- Validates list access via `ensureListAccess`.
- Query param `q` must be a non-empty string of ≥ 2 characters; return `400` otherwise.
- SQL (top 5, ranked by use_count desc, fuzzy match):

```sql
SELECT text, icon, use_count
FROM autocomplete_history
WHERE user_id = $1
  AND list_id = $2
  AND (
    text ILIKE $3          -- prefix / substring match
    OR similarity(text, $4) > 0.25   -- trigram fuzzy match
  )
ORDER BY use_count DESC, last_used_at DESC
LIMIT 5
```

- `$3` = `'%' || query || '%'`
- `$4` = raw `query`
- Response shape:

```json
{
  "suggestions": [
    { "text": "Tomaten", "icon": "IconSalad", "useCount": 7 },
    { "text": "Tomatenmark", "icon": "IconBottle", "useCount": 3 }
  ]
}
```

### Files to change
- `backend/src/routes/suggestions.js` — **new** (suggestions router, exported as `createSuggestionsRouter`)
- `backend/src/routes/entries.js` — add upsert after successful INSERT
- `backend/src/app.js` — mount `GET /api/lists/:id/suggestions` (before the entries sub-router to avoid param conflicts — use a separate `app.use` line)
- `backend/src/suggestions.test.js` — **new** (unit tests for suggestions route: auth check, list access check, min-length validation, happy path, empty result)
- `backend/src/entries.test.js` — add test: successful `POST /entries` upserts into `autocomplete_history`

### Acceptance Criteria
- `GET /suggestions?q=to` returns ≤ 5 results ordered by `use_count DESC`.
- `GET /suggestions?q=a` (1 char) returns 400.
- `GET /suggestions?q=Schokollade` (typo) returns "Schokolade" if it exists in history with similarity > 0.25.
- `POST /entries` upserts a row; repeated POST increments `use_count`.
- Upsert failure does not block the entry creation response (best-effort — catch and log, do not re-throw).
- `npm run lint`, `npm run build`, `npm test` all pass.

---

## T-003 — Frontend: `useAutocomplete` Hook + API Client

### What
A new frontend API function and React hook that feed suggestions to the UI. The hook debounces the network call, caches per-list results in IndexedDB (via the existing `sendJsonRequest` caching path), and provides an offline fuzzy-filter fallback.

### API client — `frontend/src/api/suggestions.js`

```js
export function fetchSuggestions(listId, token, query) {
  return sendJsonRequest(
    `/api/lists/${listId}/suggestions?q=${encodeURIComponent(query)}`,
    {
      method: "GET",
      token,
      cacheKey: createCacheKey("suggestions", listId),   // per-list cache key
      offlineFallbackMessage: "Offline suggestions unavailable."
    }
  );
}
```

The existing `sendJsonRequest` already writes GET responses to IndexedDB and reads them back when the network is unavailable — no extra cache logic needed in the API layer.

### Hook — `frontend/src/hooks/useAutocomplete.js`

```
useAutocomplete(listId, inputText, token)
  → { suggestions: [{ text, icon, useCount }], loading: boolean }
```

Behaviour:
- Returns `[]` immediately if `inputText.trim().length < 2`.
- Debounces the `fetchSuggestions` call by **300 ms** (cancel on unmount / next keystroke via cleanup `clearTimeout`).
- When the API call succeeds (online), sets `suggestions` to the returned array.
- When `sendJsonRequest` returns `{ offline: true, suggestions }` (cache hit), applies **client-side fuzzy filtering** before setting state (see below).
- When the API errors and there is no cache, sets `suggestions = []` silently (no error surface — autocomplete is enhancement-only).

#### Client-side fuzzy filter (offline path)

Utility `fuzzyMatch(query, text)` — returns `true` if:
- `text.toLowerCase().includes(query.toLowerCase())` (substring), **or**
- Normalised edit distance ≤ `Math.floor(query.length / 4) + 1` (allow ~1 error per 4 chars)

Apply to the cached `suggestions` array and return matches sorted by `useCount DESC`.

Edit-distance implementation: iterative two-row Levenshtein (O(m·n) time, O(m) space) — no external library.

### Files to change
- `frontend/src/api/suggestions.js` — **new**
- `frontend/src/hooks/useAutocomplete.js` — **new**
- `frontend/src/hooks/useAutocomplete.test.js` — **new**
  - Test: returns `[]` for < 2 chars
  - Test: debounce — only calls API once per burst
  - Test: applies fuzzy filter on offline cached response
  - Test: clears suggestions when input is cleared
  - Mock `fetchSuggestions` via `vi.mock`

### Acceptance Criteria
- `useAutocomplete` does not call the API for input shorter than 2 characters.
- API is called at most once per 300 ms burst.
- Offline cached suggestions are filtered by the fuzzy matcher before being returned.
- `npm run lint`, `npm run build`, `npm test` all pass.

---

## T-004 — Frontend: `AutocompleteSuggestions` Component + `AddItemSheet` Integration

### What
New presentational component for the suggestion chips, wired into `AddItemSheet`. Tapping a chip immediately triggers `onAdd(text, iconName)` — the sheet stays open (existing `AddItemSheet` behaviour already does this when `onAdd` returns non-`false` in add mode).

### Component — `frontend/src/components/AutocompleteSuggestions.jsx`

Props:
```js
{
  suggestions: [{ text: string, icon: string | null }],
  onSelect: (text, iconName) => void
}
```

Renders: a horizontal scrollable row of chips. Each chip shows:
- Icon (from `ICON_REGISTRY[icon]` — skip icon element if `icon` is null or not in registry)
- Text label

Tap target: each chip `<button>` must be at minimum **44 px tall** (CSS `min-height: 44px`).

Renders nothing (`null`) when `suggestions` is empty.

Accessibility: `role="listbox"` on the container, `role="option"` on each chip, `aria-label={suggestion.text}`.

### `AddItemSheet` changes

1. Import `useAutocomplete` and `AutocompleteSuggestions`.
2. Add prop `listId` (required for the hook; passed from `ListDetailPage`).
3. Call `const { suggestions, loading: acLoading } = useAutocomplete(listId, text, token)`.  
   - `token` must be threaded from context (`useAuth()`).
4. Render `<AutocompleteSuggestions>` between the text input field and the icon suggestion row (existing `add-item-icon-picker`).
5. `onSelect` handler: call `await onAdd(text, iconName)` — same as clicking the submit button.  
   - Do **not** clear or close after; `AddItemSheet.handleSubmit` already handles reset in add mode.

### `ListDetailPage` change

Pass `listId={id}` (already available as `useParams().id`) to both `<AddItemSheet>` instances (add and edit mode).

### CSS

Add styles in `frontend/src/index.css` (or a component-scoped file if that pattern is established):
- `.autocomplete-suggestions` — flex row, gap, overflow-x auto, padding
- `.autocomplete-chip` — flex row, align-center, gap 6px, min-height 44px, border-radius, bg token, cursor pointer
- `.autocomplete-chip:hover` / `.autocomplete-chip:focus-visible` — highlight

### Files to change
- `frontend/src/components/AutocompleteSuggestions.jsx` — **new**
- `frontend/src/components/AutocompleteSuggestions.test.jsx` — **new**
  - Test: renders nothing when `suggestions` is empty
  - Test: renders one chip per suggestion
  - Test: chip click calls `onSelect` with correct text and icon
  - Test: chip with null icon renders without crashing
- `frontend/src/components/AddItemSheet.jsx` — add `listId` prop, `useAutocomplete`, render `<AutocompleteSuggestions>`
- `frontend/src/components/AddItemSheet.test.jsx` — add test: typing ≥ 2 chars renders suggestion chips; tapping chip calls `onAdd`
- `frontend/src/pages/ListDetailPage.jsx` — pass `listId={id}` to `<AddItemSheet>`
- `frontend/src/index.css` (or equivalent) — autocomplete chip styles

### Acceptance Criteria
- Typing "Tom" in Add Item shows "Tomaten" and "Tomatenmark" chips (given history exists).
- Tapping a chip calls `onAdd` immediately; the sheet stays open.
- Chips are ≥ 44 px tall.
- Zero suggestions → chip row not rendered.
- `npm run lint`, `npm run build`, `npm test` all pass.

---

---

## T-005 — Frontend: Autocomplete Dropdown Positioning + Styling

### Problem
`AutocompleteSuggestions` is rendered as a normal grid child of `.add-item-form` (`display: grid; gap: 16px`). This causes:
- A full 16 px gap between the input and the suggestion list (should be flush / near-flush).
- The suggestions push all subsequent form content downward (layout shift) instead of overlaying it.
- The horizontal chip row doesn't match the input width or look like a dropdown.

### Fix: two coordinated changes

#### 1. `AddItemSheet.jsx` — move suggestions inside the input wrapper

Wrap the `<input>` element and the preview icon in a new `<div className="eg-input-wrap">`. Place `<AutocompleteSuggestions>` **inside** that wrapper, after the input:

```jsx
<div className="eg-field">
  <label htmlFor={textInputId}>{inputLabel}</label>
  <div className="eg-input-wrap">
    <input
      id={textInputId}
      autoComplete="off"
      autoFocus={!showIconBrowser}
      className="eg-input"
      placeholder="Add milk, lemons, bread..."
      value={text}
      onChange={(event) => setText(event.target.value)}
    />
    {loading ? (
      <div aria-live="polite" className="add-item-preview add-item-preview-loading">
        <span aria-label="Loading icon suggestion" className="add-item-preview-spinner" />
      </div>
    ) : PreviewIcon ? (
      <div aria-live="polite" className="add-item-preview" data-testid="add-item-icon-preview">
        <PreviewIcon aria-hidden="true" className="add-item-preview-svg" size={28} stroke={1.6} />
      </div>
    ) : null}
    {!isEditMode ? <AutocompleteSuggestions suggestions={suggestions} onSelect={handleQuickAdd} /> : null}
  </div>
</div>
```

Remove the standalone `{!isEditMode ? <AutocompleteSuggestions … /> : null}` line that currently sits between `.eg-field` and the icon picker.

#### 2. `index.css` — dropdown styles

**New rule — `.eg-input-wrap`:**
```css
.eg-input-wrap {
  position: relative;
}
```

**Replace `.autocomplete-suggestions`** (currently a horizontal flex row) with an absolute-positioned dropdown panel:
```css
.autocomplete-suggestions {
  position: absolute;
  top: calc(100% + 2px);   /* flush below input, 2 px breathing room */
  left: 0;
  right: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: var(--bg-raised);
  border: 1.5px solid rgba(139, 43, 226, 0.45);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  max-height: 240px;
  overflow-y: auto;
  scrollbar-width: thin;
}
```

**Replace `.autocomplete-chip`** — full-width rows instead of pills:
```css
.autocomplete-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  width: 100%;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  padding: 10px 12px;
  text-align: left;
  transition: background var(--duration-micro);
}

.autocomplete-chip:hover,
.autocomplete-chip:focus-visible {
  background: rgba(0, 229, 255, 0.10);
  outline: none;
}
```

Remove the old `transform: translateY(-1px)` hover effect — it looks wrong on a list row.

### Files to change
- `frontend/src/components/AddItemSheet.jsx` — add `autoComplete="off"` to the text input; wrap input + preview in `.eg-input-wrap`; move `<AutocompleteSuggestions>` inside that wrapper
- `frontend/src/index.css` — add `.eg-input-wrap`; replace `.autocomplete-suggestions` and `.autocomplete-chip` rules
- `frontend/src/components/AddItemSheet.test.jsx` — verify suggestions render inside the input wrapper (query within `.eg-input-wrap`)
- `frontend/src/components/AutocompleteSuggestions.test.jsx` — no structural changes needed; chip click test still valid

### Acceptance Criteria
- Native browser autocomplete is suppressed (`autoComplete="off"`) — only one suggestion list visible.
- Suggestion list appears **directly below** the text input with no extra gap (≤ 4 px).
- Suggestion list has the **same width** as the input field (left-aligned, full width of the wrapper).
- Suggestion list **overlays** content below it — the icon picker and buttons do not shift when suggestions appear or disappear.
- Each suggestion row is ≥ 44 px tall and spans the full dropdown width.
- Empty suggestions → dropdown not rendered, no layout impact.
- `npm run lint`, `npm run build`, `npm test` all pass.

---

## Validation

Run after every task and again before the final commit:

```
npm run lint
npm run build
npm test
```
