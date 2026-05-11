# PLAN — ui-improvements cycle

Generated: 2026-05-11
Source: ROADMAP.md (7 priorities)
Recommended implementation order: T-003 → T-007 → T-006 → T-002 → T-001 → T-004 → T-005

---

## T-001 — Icon suggestion: compound-word matching

### Goal
`useIconSuggestion` must resolve German compound words (e.g. "Spritzpaprika",
"Minimöhren") to the correct icon synchronously by detecting that the input
_contains_ a known tag term.

### Files to change
| File | Change |
|------|--------|
| `frontend/src/hooks/useIconSuggestion.js` | Extend `getExactOrPrefixIcon` with substring check |
| `frontend/src/hooks/useIconSuggestion.test.js` | Add 2 compound-word test cases |

### Implementation detail

In `getExactOrPrefixIcon`, after the existing exact-match and prefix checks, add a
third pass that finds the **longest** known term contained within the input.
A minimum length guard of **4 characters** prevents short keys like `"ei"` from
matching unrelated words.

```js
// 3. Substring match — input contains a known term (≥ 4 chars), pick longest
let bestSubstringIcon = null;
let bestSubstringLength = 0;
for (const [term, icon] of Object.entries(EXACT_MATCH_MAP)) {
  if (term.length >= 4 && normalizedText.includes(term) && term.length > bestSubstringLength) {
    bestSubstringIcon = icon;
    bestSubstringLength = term.length;
  }
}
if (bestSubstringIcon) {
  return bestSubstringIcon;
}
```

The return value and call signature of `useIconSuggestion` are unchanged.

### Tests to add (in `useIconSuggestion.test.js`)
```
it("returns the bell-pepper icon for compound input containing 'paprika'")
  → useIconSuggestion("Spritzpaprika") === "CustomBellPepper", loading false, no worker call

it("returns the carrot icon for compound input containing 'möhren'")
  → useIconSuggestion("Minimöhren") === "IconCarrot", loading false, no worker call
```
Both tests must assert `requestIconMatch` was **not** called (synchronous path).

---

## T-002 — Replace cucumber SVG

### Goal
Replace `cucumber.svg` with a cleaner, clearly recognisable cucumber icon using
the project's established stroke style.

### Files to change
| File | Change |
|------|--------|
| `frontend/src/assets/icons/custom/cucumber.svg` | Full replacement |

### Implementation detail
SVG requirements:
- `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`,
  `stroke-width="1.5"`, `stroke-linecap="round"`, `stroke-linejoin="round"`
- No hardcoded colours, no `fill` on any path.
- Visually: a diagonal elongated oval body (the cucumber), a small stem nub at
  the narrow end, and 2–3 short diagonal stroke lines across the body to suggest
  texture/bumps.
- Consistent visual weight with `bellPepper.svg` and `tomato.svg`.

No JS, registry, or test-file changes required — the icon is already registered
as `CustomCucumber` and referenced in `iconDatabase.js`.

---

## T-003 — Flatten entry sections (no card framing)

### Goal
Remove the card appearance (border, border-radius, background, side padding) from
`.entry-section` so both "Offene Einträge" and "Zuletzt verwendet" render as plain
headings + item lists with no visible frame.

### Files to change
| File | Change |
|------|--------|
| `frontend/src/index.css` | Split combined selector; strip card styles from `.entry-section` |

### Implementation detail

Current combined rule (around line 1225):
```css
.list-card,
.entry-section,
.sharing-panel {
  border: 1px solid rgba(139, 43, 226, 0.25);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  padding: 1.25rem;
}
```

Replace with two rules:
```css
/* Card components keep their full appearance */
.list-card,
.sharing-panel {
  border: 1px solid rgba(139, 43, 226, 0.25);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  padding: 1.25rem;
}

/* Entry sections: flat content blocks, no card frame */
.entry-section {
  padding: var(--space-2) 0;   /* vertical rhythm only; zero side padding */
}
```

`border`, `border-radius`, and `background` are simply absent from `.entry-section`.
The `.recently-used-section` class already extends `.entry-section` and inherits
this treatment automatically.

Verify that the parent `.detail-content` already provides side padding so items
are not flush with the screen edge. No JS or test-file changes required.

---

## T-004 — Optimistic UI: instant toggle and reactivate

### Goal
`toggleStatus` and `addEntryByText` must update local state **before** the API
call resolves so the UI responds immediately regardless of network speed.

### Files to change
| File | Change |
|------|--------|
| `frontend/src/pages/ListDetailPage.jsx` | Refactor `toggleStatus` and `addEntryByText` |
| `frontend/src/pages/ListDetailPage.test.jsx` | Add optimistic-UI test cases |

### Implementation detail — `toggleStatus`

Rewrite to apply the optimistic state update first, then fire the API call.
Revert only on non-network errors (network errors are handled by the offline queue
which returns `{ queued: true }` without throwing).

```js
async function toggleStatus(entry) {
  const nextStatus = entry.status === "open" ? "done" : "open";

  // 1. Optimistic update — immediate UI change
  const optimisticEntry = { ...entry, status: nextStatus, is_pending_sync: true };
  await updateEntries((currentEntries) =>
    sortEntries(
      currentEntries.map((e) => (e.id === entry.id ? optimisticEntry : e))
    )
  );
  if (nextStatus === "done") {
    setRecentlyUsed((current) => upsertRecentlyUsedItems(current, entry));
  }

  try {
    setEntryError("");
    const result = await updateEntry(id, entry.id, token, { status: nextStatus });

    // 2. Settle with real server data (or confirm queued state)
    await updateEntries((currentEntries) =>
      sortEntries(
        currentEntries.map((e) =>
          e.id === entry.id
            ? { ...e, ...(result?.queued ? { is_pending_sync: true } : result.entry) }
            : e
        )
      )
    );
    if (nextStatus === "done" && !result?.queued) {
      setRecentlyUsed((current) =>
        upsertRecentlyUsedItems(current, result?.entry ?? entry)
      );
    }
  } catch (submitError) {
    // 3. Revert on server-side (non-network) error
    await updateEntries((currentEntries) =>
      sortEntries(currentEntries.map((e) => (e.id === entry.id ? entry : e)))
    );
    if (nextStatus === "done") {
      setRecentlyUsed((current) =>
        current.filter((item) => item.text !== entry.text)
      );
    }
    setEntryError(submitError.message);
  }
}
```

### Implementation detail — `addEntryByText`

Move the temporary entry creation and UI insertion **before** `await createEntry`.
On API success, replace the temp entry with the real one. On failure, remove it.

```js
async function addEntryByText(text, icon, details = "") {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const nextDetails = normalizeEntryDetails(details);
  const temporaryEntry = {
    id: createTemporaryId("entry"),
    text: trimmed,
    icon: icon ?? null,
    details: nextDetails,
    status: "open",
    created_at: new Date().toISOString(),
    is_pending_sync: true
  };

  // 1. Optimistic insert — appears immediately
  await updateEntries((currentEntries) =>
    sortEntries([...currentEntries, temporaryEntry])
  );

  try {
    setEntryError("");
    const result = await createEntry(
      id,
      token,
      { text: trimmed, icon: icon ?? null, details },
      { tempId: temporaryEntry.id }
    );

    // 2. Replace temp with settled entry
    await updateEntries((currentEntries) =>
      sortEntries(
        currentEntries.map((e) =>
          e.id === temporaryEntry.id
            ? (result?.queued ? temporaryEntry : result.entry)
            : e
        )
      )
    );
    return true;
  } catch (submitError) {
    // 3. Revert on error
    await updateEntries((currentEntries) =>
      currentEntries.filter((e) => e.id !== temporaryEntry.id)
    );
    setEntryError(submitError.message);
    return false;
  }
}
```

`handleAddFromHistory` already removes the item from recently-used before calling
`addEntryByText`, so no changes are needed there — the optimistic insert in
`addEntryByText` covers the "immediate open-entries appearance" requirement.

### Tests to add (`ListDetailPage.test.jsx`)

Add render-based tests (mock `fetchLists`, `fetchEntries`, `fetchRecentlyUsed`,
`updateEntry`, `createEntry` from their respective API modules):

```
it("removes a toggled entry from the open list in the same render cycle")
  → mock updateEntry to never resolve → click toggle button
  → entry must be gone from the list before updateEntry resolves

it("reverts a toggled entry when the API returns a non-network error")
  → mock updateEntry to reject with new Error("Server error")
  → entry reappears, error banner shown

it("adds a temp entry to open entries immediately when reactivating from history")
  → mock createEntry to never resolve → click recently-used chip
  → temp entry (is_pending_sync) appears in open entries immediately
```

---

## T-005 — Tile grid for open entries and recently-used section

### Goal
Replace the full-width row layout with space-efficient grid layouts:
- Open entries → 3-column tile grid; tap to toggle done; long-press to edit
- Recently used → 2-column chip grid with overlay dismiss badge

### Files to change
| File | Change |
|------|--------|
| `frontend/src/hooks/useLongPress.js` | New hook (extracted from tile component) |
| `frontend/src/hooks/useLongPress.test.js` | New unit tests for the hook |
| `frontend/src/components/EntryTile.jsx` | New component replacing `EntryRow` |
| `frontend/src/components/EntryRow.jsx` | Delete (replaced by `EntryTile.jsx`) |
| `frontend/src/components/entry-tile.test.jsx` | New test file (replaces `entry-row.test.jsx`) |
| `frontend/src/components/entry-row.test.jsx` | Delete |
| `frontend/src/components/RecentlyUsedSection.jsx` | Restructure to 2-column grid |
| `frontend/src/components/RecentlyUsedSection.test.jsx` | Update selectors |
| `frontend/src/pages/ListDetailPage.jsx` | Use `EntryTile`, remove `handleDeleteEntry` |
| `frontend/src/pages/ListDetailPage.test.jsx` | Update to match new structure |
| `frontend/src/index.css` | Add tile grid CSS; update recently-used grid CSS |

### Implementation detail — `useLongPress.js`

```js
import { useRef, useState } from "react";

export function useLongPress(onLongPress, ms = 500) {
  const timerRef = useRef(null);
  const longPressedRef = useRef(false);
  const [pressing, setPressing] = useState(false);

  function start() {
    longPressedRef.current = false;
    setPressing(true);
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      setPressing(false);
      onLongPress();
    }, ms);
  }

  function cancel() {
    setPressing(false);
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function handleClick(e) {
    // Suppress the synthetic click that follows touchend when a long-press fired
    if (longPressedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      longPressedRef.current = false;
    }
  }

  return {
    pressing,
    longPressHandlers: {
      onMouseDown: start,
      onMouseUp: cancel,
      onMouseLeave: cancel,
      onTouchStart: start,
      onTouchEnd: cancel,
      onTouchCancel: cancel,
      onClick: handleClick
    }
  };
}
```

### Implementation detail — `EntryTile.jsx`

```jsx
import { useTranslation } from "react-i18next";
import { FALLBACK_ICON, FALLBACK_ICON_NAME, ICON_REGISTRY, resolveIconName }
  from "../data/iconRegistry";
import { useLongPress } from "../hooks/useLongPress";
import { Icon } from "./ui";

export default function EntryTile({ entry, onToggle, onEdit }) {
  const { t } = useTranslation();
  const resolvedIconName = resolveIconName(entry.icon);
  const EntryIcon = ICON_REGISTRY[resolvedIconName] ?? FALLBACK_ICON;
  const { pressing, longPressHandlers } = useLongPress(() => onEdit?.(), 500);

  return (
    <button
      aria-label={
        entry.status === "done"
          ? t("entry.markOpen", { name: entry.text })
          : t("entry.markDone", { name: entry.text })
      }
      className={[
        "entry-tile",
        entry.status === "done" ? "entry-tile--done" : "",
        pressing ? "entry-tile--pressing" : "",
        entry.is_pending_sync ? "entry-tile--pending" : ""
      ].filter(Boolean).join(" ")}
      data-testid={`entry-tile-${entry.id}`}
      type="button"
      {...longPressHandlers}
      onClick={(e) => {
        longPressHandlers.onClick(e);
        if (!e.defaultPrevented) onToggle?.();
      }}
    >
      <EntryIcon
        aria-hidden="true"
        className="entry-tile-icon"
        data-icon-name={resolvedIconName ?? FALLBACK_ICON_NAME}
        data-testid={`entry-tile-icon-${entry.id}`}
        size={24}
        stroke={1.5}
      />
      <p className="entry-tile-text">{entry.text}</p>
      {entry.details ? <p className="entry-tile-details">{entry.details}</p> : null}
      {entry.is_pending_sync
        ? <span className="eg-chip-queued entry-tile-chip">{t("common.queued")}</span>
        : null}
    </button>
  );
}
```

**onClick / longPress interaction:** `longPressHandlers.onClick` calls
`e.preventDefault()` when a long-press just fired, setting `defaultPrevented`.
The outer `onClick` checks this before calling `onToggle` so only one action fires.

### Implementation detail — CSS for `EntryTile`

Add to `index.css`:
```css
.entry-tile-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.entry-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border: 1px solid rgba(139, 43, 226, 0.18);
  border-radius: var(--radius-md);
  background: var(--bg-raised);
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
  text-align: center;
  transition: opacity 0.15s ease, transform 0.15s ease,
              border-color var(--duration-micro);
  user-select: none;
  -webkit-user-select: none;
}

.entry-tile:hover {
  border-color: rgba(0, 229, 255, 0.3);
}

.entry-tile--pressing {
  opacity: 0.55;
  transform: scale(0.94);
}

.entry-tile--done {
  opacity: 0.4;
  border-color: rgba(0, 229, 176, 0.2);
}

.entry-tile-icon {
  flex-shrink: 0;
}

.entry-tile-text {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.entry-tile-details {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-secondary);
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.entry-tile-chip {
  font-size: 0.65rem;
}
```

### Implementation detail — `RecentlyUsedSection.jsx` (2-column grid)

Replace the current `recently-used-list` / `recently-used-chip-row` structure.
Each grid cell holds the chip button and an absolutely-positioned dismiss badge.

```jsx
<div className="recently-used-grid">
  {items.map((item) => {
    const resolvedIconName = resolveIconName(item.icon) ?? FALLBACK_ICON_NAME;
    const ItemIcon = ICON_REGISTRY[resolvedIconName];
    return (
      <div key={item.text} className="recently-used-cell">
        <button
          aria-label={item.text}
          className="recently-used-chip"
          type="button"
          onClick={() => onAdd?.(item.text, item.icon ?? null)}
        >
          <ItemIcon
            aria-hidden="true"
            className="recently-used-chip-icon"
            data-icon-name={resolvedIconName}
            size={20}
            stroke={1.6}
          />
          <span className="recently-used-chip-text">{item.text}</span>
        </button>
        <button
          aria-label={t("recent.dismiss", { name: item.text })}
          className="recently-used-chip-dismiss"
          type="button"
          onClick={() => onDismiss?.(item.text)}
        >
          <Icon color="var(--text-secondary)" name="x" size={14} />
        </button>
      </div>
    );
  })}
</div>
```

### CSS for `RecentlyUsedSection` (replace / update existing rules)

```css
/* Replace .recently-used-list */
.recently-used-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.recently-used-cell {
  position: relative;
}

/* Update .recently-used-chip to column/tile layout */
.recently-used-chip {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(0, 229, 255, 0.18);
  border-radius: var(--radius-md);   /* was 999px */
  background: rgba(0, 229, 255, 0.08);
  color: var(--text-primary);
  cursor: pointer;
  padding: 10px 8px;
  text-align: center;
  user-select: none;
  -webkit-user-select: none;
}

.recently-used-chip-text {
  font-size: 0.8rem;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

/* Dismiss button as overlay badge (top-right corner) */
.recently-used-chip-dismiss {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

/* Remove old row-based rules */
/* Delete: .recently-used-list, .recently-used-chip-row */
```

### `ListDetailPage.jsx` changes

1. Replace `import EntryRow` → `import EntryTile from "../components/EntryTile"`.
2. Wrap the `openEntries.map(...)` in `<div className="entry-tile-grid">`.
3. Replace `<EntryRow ... onDelete onEdit onToggle>` with
   `<EntryTile ... onToggle onEdit>` (no `onDelete`).
4. Remove `handleDeleteEntry` function entirely.

### Tests

**`useLongPress.test.js`** (new):
```
it("does not call onLongPress on a short tap (< 500 ms)")
it("calls onLongPress after 500 ms hold")
it("sets pressing=true while held and pressing=false after release")
it("does not call onLongPress if pointer leaves before threshold")
```

**`entry-tile.test.jsx`** (replaces `entry-row.test.jsx`):
```
it("renders the persisted icon")
it("renders the fallback cart icon when no icon is set")
it("renders a details line when details are present")
it("omits the details line when details are absent")
it("calls onToggle on a short tap")
it("calls onEdit after a 500 ms hold and does NOT call onToggle")
it("adds entry-tile--pressing class while held")
```

**`RecentlyUsedSection.test.jsx`**: existing tests rely on aria-label
`t("recent.dismiss", { name })` — keep those assertions; update any selector that
referenced `.recently-used-chip-row` to use `.recently-used-cell`.

---

## T-006 — Mobile fix: icon browser visible on small screens

### Goal
Fix the bottom sheet exceeding the visible viewport when the virtual keyboard is
shown on mobile.

### Files to change
| File | Change |
|------|--------|
| `frontend/src/index.css` | Replace `vh` with `dvh`; add explicit `--browser-open` override |

### Implementation detail

```css
/* was: max-height: min(80vh, 44rem) */
.bottom-sheet {
  max-height: min(80dvh, 44rem);
}

/* New rule — more height for the icon browser */
.bottom-sheet--browser-open {
  max-height: min(92dvh, 44rem);
}
```

`dvh` (dynamic viewport height) shrinks automatically when the iOS/Android
software keyboard appears. Supported in Chrome 108+, Safari 15.4+, Firefox 101+.

No JS changes required.

---

## T-007 — Shrink "Mehr anzeigen" toggle to link style

### Goal
The icon-browser toggle button must look like an inline text link, not a ghost button.

### Files to change
| File | Change |
|------|--------|
| `frontend/src/components/AddItemSheet.jsx` | Remove `eg-btn-ghost` from the toggle button's `className` |
| `frontend/src/index.css` | Replace stub `.add-item-more-btn` rule with link-style rules |

### Implementation detail

**`AddItemSheet.jsx`**:
```jsx
// Before
className="eg-btn-ghost add-item-more-btn"
// After
className="add-item-more-btn"
```

**`index.css`** — replace the existing one-liner `.add-item-more-btn { width: fit-content; }`:
```css
.add-item-more-btn {
  width: fit-content;
  padding: 0.15rem 0;
  border: 0;
  background: none;
  color: var(--neon-violet);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: text-decoration-color var(--duration-micro), opacity var(--duration-micro);
}

.add-item-more-btn:hover,
.add-item-more-btn:focus-visible {
  text-decoration-color: currentColor;
  opacity: 0.85;
}
```

The `<button>` element and its type/role remain unchanged. No test-file changes
required.

---

## Validation checklist (run after every task)

```
npm run lint
npm run build
npm test
```

All three must pass before marking a task `ready_for_review`.

---

## T-008 — Remove obsolete swipe-to-delete E2E test

### Goal
The E2E test `deletes an item from a shopping list via swipe` references `.entry-row`
and swipe-to-delete behaviour that were intentionally removed in T-005. The test fails
on every CI run. Remove it and the `swipeEntryLeft` helper that only it uses.

### Background
`EntryRow.jsx` was replaced by `EntryTile.jsx` in T-005. Swipe-to-delete was a
deliberate product decision to drop (ROADMAP Priority 5: "Remove swipe-to-delete").
The E2E test was not cleaned up at that time, causing the current CI failure.

### Files to change
| File | Change |
|------|--------|
| `e2e/lists.spec.js` | Remove `swipeEntryLeft` helper (lines 60–106) and the test block `deletes an item from a shopping list via swipe` (lines 142–155) |

### Implementation detail
- Delete the entire `swipeEntryLeft` async function (lines 60–106).
- Delete the entire `test("deletes an item from a shopping list via swipe", ...)` block (lines 142–155).
- Keep `openItemsSection` and `recentlyUsedSection` helpers — they are used by the remaining tests.
- No other files require changes.

### Validation
```
npm run lint
npm run build
npm test
```
All three must pass. The E2E suite itself runs in CI only; local validation via
`npm test` (unit tests) is sufficient to confirm no regressions in the unit layer.
