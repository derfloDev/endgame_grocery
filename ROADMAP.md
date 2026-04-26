# ROADMAP

## Priority 1 — Automatic Icon Assignment (auto-icons)

**Objective:** Assign a food/grocery emoji icon to each list entry automatically,
using local in-browser semantic matching (transformers.js) so that synonyms and
cross-language terms are recognised without any cloud AI dependency.

### Accepted decisions

| # | Decision |
|---|----------|
| Persistence | **Option B – store in DB**: the resolved icon is saved in the `entries` table so all list members see the same icon regardless of client state. |
| UI placement | **Both**: live preview in `AddItemSheet` while typing, and permanent display in `EntryRow`. |
| Language | **Bilingual (EN + DE)**: the icon reference database covers both English and German grocery terms. |
| Model loading | **Eager**: `Xenova/all-MiniLM-L6-v2` (~23 MB WASM) starts loading in the background immediately on app start via the Service Worker; subsequent sessions use the browser cache. |
| Similarity threshold | **Configurable constant** exposed as an env var (`VITE_ICON_SIMILARITY_THRESHOLD`) and wired into `docker-compose.yml` so it can be tuned without code changes. Default: `0.5`. |

### Planned outcomes

- `entries` table gains a nullable `icon` column (text, stores a single emoji).
- Backend `POST /api/lists/:id/entries` and `PATCH /api/lists/:id/entries/:eid`
  accept an optional `icon` field and return it in all entry responses.
- A bilingual icon reference database (`src/data/iconDatabase.js`) with ≥ 60
  entries covering common grocery categories (dairy, produce, bakery, meat,
  beverages, snacks, household).
- A `useIconSuggestion` hook that:
  1. Runs an O(1) exact/prefix string-match map first.
  2. Falls back to cosine-similarity over transformer embeddings when no exact
     match is found.
  3. Returns `{ icon, loading }` so callers can show a spinner.
- `AddItemSheet` shows the resolved icon as a live preview badge next to the
  input; the icon is passed to `onAdd` so the page can persist it.
- `EntryRow` renders the persisted `entry.icon` (or `🛒` fallback) to the left
  of the item text.
- The transformer model worker is initialised eagerly on app start (background
  import, does not block render).
- `VITE_ICON_SIMILARITY_THRESHOLD` env var controls the cutoff (default `0.5`);
  added to `docker-compose.yml` and `.env.example`.
- All new behaviour is covered by unit tests (hook logic, similarity util,
  string-match map).
- Documentation updated: `README.md` env-var table, inline JSDoc for public
  hook API.
