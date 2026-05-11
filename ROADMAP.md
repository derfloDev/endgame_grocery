# ROADMAP — ui-improvements cycle

Goal: Polish the grocery list UI with seven targeted improvements spanning icon
suggestions, icon quality, visual layout, perceived responsiveness, and mobile
usability.

---

## Priority 1 — Icon suggestion: compound-word matching

**Objective:** Typing German compound words that embed a known ingredient term must
suggest the correct icon without requiring an exact/prefix match.

Concrete cases that must work after the change:
- "Spritzpaprika" → `CustomBellPepper` (contains the tag "paprika")
- "Minimöhren" → `IconCarrot` (contains the tag "möhren")

**Approach:** Extend `getExactOrPrefixIcon` in `useIconSuggestion.js` to check whether
the normalised input _contains_ a known EXACT_MATCH_MAP key (substring matching). Add a
minimum key length guard (≥ 4 characters) to prevent short terms like "ei" from
producing false positives.

**Acceptance criteria:**
- `useIconSuggestion("Spritzpaprika")` returns `{ iconName: "CustomBellPepper", ... }` synchronously (no worker needed).
- `useIconSuggestion("Minimöhren")` returns `{ iconName: "IconCarrot", ... }` synchronously.
- Existing exact/prefix test cases continue to pass.
- Unit tests cover both new compound-word cases.

---

## Priority 2 — Icon quality: replace cucumber SVG

**Objective:** The `CustomCucumber` icon looks off; replace it with a cleaner,
more recognisable cucumber silhouette that follows the same stroke style as the
other custom SVG icons (stroke="currentColor", no fill, viewBox 0 0 24 24).

**Acceptance criteria:**
- `frontend/src/assets/icons/custom/cucumber.svg` renders a clearly identifiable
  cucumber (e.g. diagonal body with bump/seed texture lines).
- SVG uses only `stroke="currentColor"`, `stroke-linecap="round"`,
  `stroke-linejoin="round"`, no hardcoded fill or color values.
- Visual consistency with `CustomBellPepper` and `CustomTomato`.

---

## Priority 3 — Visual: flatten entry sections (no card framing)

**Objective:** The "Offene Einträge" and "Zuletzt verwendet" sections currently look
like cards (border, background, rounded corners, side padding). They should instead
render as plain content sections: section heading directly above the items, no
border, no background, no horizontal padding. Vertical spacing between sections is
preserved.

**CSS changes for `.entry-section`:**
- Remove `border`
- Remove `border-radius`
- Remove `background`
- Remove horizontal padding (`padding-left`, `padding-right` → 0); keep or adjust
  vertical spacing as needed so the heading and items don't feel cramped.

**Acceptance criteria:**
- `.entry-section` has no visible border, no card background, and no side padding.
- `.list-card` and `.sharing-panel` card appearance is unchanged.
- Sections still have clear vertical separation from each other and from surrounding
  content.
- No regression in item layout within the sections.

---

## Priority 4 — Optimistic UI: instant feedback on toggle and reactivate

**Objective:** Marking an open entry as "done" or re-activating an item from
"Zuletzt verwendet" must update the UI immediately—before the network round-trip
completes—so the action feels instant even on a slow or offline connection.

**Current behaviour:**
- `toggleStatus` awaits `updateEntry(...)` before touching local state → the item
  stays on the open list for the full network timeout.
- `handleAddFromHistory` removes the item from recently-used instantly but only
  adds it to open entries after `addEntryByText` (which awaits `createEntry`)
  completes.

**Required behaviour:**
- `toggleStatus`: immediately apply the new status in local state and add to
  recently-used (if toggling to "done"); fire the API call in the background; on
  non-network failure revert the local state and surface the error.
- `handleAddFromHistory`: immediately add a temporary entry (with `is_pending_sync`)
  to open entries in addition to removing from recently-used; replace it with the
  real entry on API success, or revert on non-network failure.

**Acceptance criteria:**
- Toggling an entry to "done" removes it from the open list in the same render cycle
  as the click, regardless of network state.
- Re-activating a recently-used item adds it to open entries in the same render
  cycle, regardless of network state.
- Non-network API errors revert the optimistic state and display the error message.
- Existing test coverage for `toggleStatus` and `handleAddFromHistory` is updated to
  verify optimistic behaviour.

---

## Priority 5 — Layout: tile grid for open entries and recently-used section

**Objective:** Replace the single-column list layout in both sections with
space-efficient grid layouts that show more items per screen.

### Open entries → 3-column tile grid

Each tile shows: icon (top), item text, optional details. Tapping a tile toggles
the item to "done" (optimistic, per Priority 4). Long-pressing a tile opens the
edit sheet.

Changes vs. current `EntryRow`:
- **Remove** swipe-to-delete (deletion is no longer available directly from open
  entries; "Zuletzt verwendet" dismiss covers the archiving use-case).
- **Remove** the inline edit button.
- **Add** long-press handler (~500 ms) to trigger `onEdit`.
- Layout: 3 equal columns, icon centred at top of tile, text below, details below
  text (truncated to 2 lines if long).
- The `handleDeleteEntry` function in `ListDetailPage` is no longer wired to the
  tile grid; it can be removed if nothing else calls it.

### Recently-used → 2-column chip grid

Each chip shows icon + text. The dismiss button becomes a small overlay X badge
in the top-right corner of each chip. Chips wrap into 2 equal columns.

**Acceptance criteria:**
- Open entries render in a 3-column CSS grid (`repeat(3, 1fr)`).
- Recently-used items render in a 2-column CSS grid (`repeat(2, 1fr)`).
- Long-pressing an entry tile for ≥ 500 ms triggers the edit sheet; while held,
  the tile shows a subtle visual feedback (slight scale-down + opacity reduction).
- Tapping (short press) still toggles done status.
- No swipe or delete action is available from the open entries grid.
- All text that overflows a tile is truncated with an ellipsis.
- Component and page tests are updated to reflect the new structure.

---

## Priority 6 — Mobile fix: icon browser visible on small screens

**Objective:** On mobile devices, opening the icon browser inside AddItemSheet
causes the icon grid to be hidden or cut off. Fix the layout so the icon list
is always fully scrollable within the visible viewport, even when the virtual
keyboard is shown.

**Root cause:** `.bottom-sheet` uses `max-height: min(80vh, 44rem)`. On mobile,
`vh` is measured against the initial (full) viewport height and does not shrink
when the virtual keyboard appears, so the sheet can extend below the visible area.
Additionally, `.bottom-sheet--browser-open` switches to `overflow: hidden` (flex
layout), so the outer sheet no longer scrolls; if the flex chain does not resolve
to a usable height, the icon grid appears empty.

**Fix:**
- Replace `vh` with `dvh` (dynamic viewport height) so the sheet automatically
  shrinks when the keyboard is shown:
  `max-height: min(80dvh, 44rem)` on `.bottom-sheet`.
- When `--browser-open`, allow the sheet to grow further:
  `max-height: min(92dvh, 44rem)` on `.bottom-sheet--browser-open` to maximise
  the available icon grid space.
- Verify the flex/overflow chain for `.bottom-sheet--browser-open →
  .add-item-icon-browser → .add-item-icon-browser-grid` gives the grid a
  concrete height so it scrolls correctly.

**Acceptance criteria:**
- Opening the icon browser on a typical mobile screen (375 × 667 px viewport,
  ~300 px keyboard) shows the icon grid and allows scrolling through all icons.
- The fix does not break the icon browser on desktop (where `dvh ≈ vh`).
- CSS-only change; no JS required.

---

## Priority 7 — UX: shrink "Mehr anzeigen" toggle to link style

**Objective:** The "Mehr anzeigen / Weniger anzeigen" button that opens the icon
browser uses the full `.eg-btn-ghost` style (large padding, border, background).
It should look like an inline text link to reduce vertical height.

**Fix:** Remove `.eg-btn-ghost` from the toggle button; apply a new modifier class
`.add-item-more-btn` (already exists) that overrides the button to link appearance:
no border, no background, minimal vertical padding, text colour `var(--neon-violet)`,
optional underline on hover.

**Acceptance criteria:**
- The toggle button height is visually similar to a text line (≤ ~1.8 rem total).
- No border or background is visible on the button in its default state.
- Hover/focus state still provides a clear affordance (colour change or underline).
- The button remains keyboard-accessible (`role` stays `button`; no change to HTML
  element).
