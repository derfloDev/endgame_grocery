# ROADMAP

Goal: deliver smart autocomplete for the Add Item flow so users can build grocery lists faster, even offline.

## Priority 1 — Smart Autocomplete

Objective: show ranked product-name suggestions as the user types in the Add Item sheet. Tapping a suggestion immediately adds the item to the list (no extra confirmation). The ranking learns from per-list usage history stored on the backend and survives offline via a local cache.

### Acceptance Criteria

- Suggestions appear after the user types ≥ 2 characters into the Add Item input.
- Up to 5 suggestions are shown, each displaying the product icon and label.
- Suggestions are ranked by per-list usage frequency (most-used items first).
- Fuzzy/typo-tolerant matching: e.g. "Schokollade" surfaces "Schokolade".
- Tapping a suggestion directly adds the item (text + icon) to the list; the sheet stays open for the next entry.
- Every successfully created entry (manual or via autocomplete) increments that item's use-count in the backend history for the current list.
- When offline, the last successfully fetched suggestion set for each list is served from a local cache (localStorage); client-side prefix + edit-distance filtering is applied to the cached set.
- Autocomplete suggestions load within 300 ms on a fast connection (debounced input).
- All new UI is thumb-reachable on mobile (suggestion chips ≥ 44 px tap target).

### Decisions Made

| # | Question | Choice |
|---|----------|--------|
| 1 | Suggestion source | Backend-driven (DB history) |
| 2 | Tap-to-add behaviour | Direct add, sheet stays open |
| 3 | Fuzzy matching | Independent autocomplete mechanism (not reusing icon worker) |
| 4 | History scope | Per-list (user × list) |
| 5 | Offline fallback | Last cached suggestions (localStorage), client-side fuzzy filter |

### Scope

**Backend**
- New DB migration: `autocomplete_history` table (`user_id`, `list_id`, `text`, `icon`, `use_count`, `last_used_at`; unique on `user_id + list_id + text`).
- `POST /api/lists/:id/entries` upserts into `autocomplete_history` on every successful entry creation (both manual and autocomplete paths).
- New endpoint `GET /api/lists/:id/suggestions?q=<query>` — returns top 5 suggestions for the list, ranked by `use_count DESC`, fuzzy-matched via `ILIKE` / `pg_trgm` similarity on `text`.

**Frontend**
- New `useAutocomplete(listId, inputText, token)` hook:
  - Debounces API call (300 ms).
  - Caches last API response per `listId` in localStorage.
  - When offline or API fails, loads from cache and applies client-side prefix + edit-distance filtering.
- New `AutocompleteSuggestions` component: renders up to 5 suggestion chips (icon + label), ≥ 44 px tap targets.
- `AddItemSheet` integration: render suggestions below the text input; on chip tap call `onAdd(text, icon)` directly.

**Out of scope for this cycle**
- Cross-list or global history.
- Deleting or managing autocomplete history.
- Surfacing suggestions on the Edit Item sheet.
