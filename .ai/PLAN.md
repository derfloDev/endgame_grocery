# Plan

Status: **ready**

Goal: deliver all UI enhancements defined in `ROADMAP.md` across five focused tasks.

---

## Scope

Five independent tasks, each ownable as a single commit:

| ID | Title |
|----|-------|
| T-001 | List item animations |
| T-002 | Spacing fixes |
| T-003 | Mobile & visual fixes |
| T-004 | Feature additions |
| T-005 | Feature removals |

---

## T-001 — List Item Animations

### Goal
Smooth fade-out when an item leaves "Open items" (local toggle, local delete, SSE delete) and smooth fade-in when an item appears in "Open items" (SSE create) or in "Recently used" (any add).

### Acceptance Criteria
- Marking an item done triggers a ~300 ms fade-out + slight downscale on the row before the row disappears from the list.
- Hard-deleting an item (swipe or icon) triggers the same exit animation.
- When a shared user creates an entry via SSE, the new row fades in (~300 ms).
- When a shared user deletes an entry via SSE, the row fades out before removal.
- When an item is re-added from "Recently used", the chip fades/slides in.
- Animations respect `prefers-reduced-motion` (instant show/hide when enabled).

### Implementation

**New CSS keyframes** (`frontend/src/index.css` / `tokens.css`):
```css
@keyframes entryFadeIn  { from { opacity:0; transform: translateY(-6px); } to { opacity:1; transform: translateY(0); } }
@keyframes entryFadeOut { from { opacity:1; transform: scale(1); }          to { opacity:0; transform: scale(0.95); } }
```
Apply via utility classes `.entry-entering` (entryFadeIn 300 ms ease-out forwards) and `.entry-exiting` (entryFadeOut 300 ms ease-out forwards).
Add `@media (prefers-reduced-motion: reduce)` block that overrides duration to 0 ms.

**`ListDetailPage.jsx`**:
- Add `exitingIds` state (`Set<string>`) and `enteringIds` state (`Set<string>`).
- Extract helper `scheduleExit(id, fn)`: adds id to `exitingIds`, waits 300 ms, calls fn, removes from `exitingIds`.
- **Local toggle done**: call `scheduleExit(entry.id, () => updateEntries(...))` instead of updating immediately.
- **Local delete**: call `scheduleExit(entry.id, () => deleteEntry(...).then(updateEntries(...)))`.
- **SSE `entry:deleted`**: replace plain `handleEntryChange` for the deleted event with a diff-aware version that adds the disappeared id to `exitingIds`, waits 300 ms, then calls `loadEntries()`.
- **SSE `entry:created`**: after `loadEntries()` resolves, compare old vs new entries, add new ids to `enteringIds`, clear after 300 ms.
- Pass `isExiting={exitingIds.has(entry.id)}` and `isEntering={enteringIds.has(entry.id)}` to each `<EntryRow>`.
- Pass `newlyAddedTexts` (Set of texts just added back from history) to `<RecentlyUsedSection>`.

**`EntryRow.jsx`**:
- Accept `isExiting` and `isEntering` props.
- Apply `.entry-exiting` class when `isExiting`, `.entry-entering` when `isEntering`.
- When `isExiting`, set `pointer-events: none` via inline style or CSS to prevent interaction during fade.

**`RecentlyUsedSection.jsx`**:
- Accept `newlyAddedTexts: Set<string>` prop.
- Apply `.entry-entering` (or a `.chip-entering` variant) class to chips whose `text` is in `newlyAddedTexts`.

### Files to Change
- `frontend/src/pages/ListDetailPage.jsx`
- `frontend/src/components/EntryRow.jsx`
- `frontend/src/components/RecentlyUsedSection.jsx`
- `frontend/src/index.css` (new keyframes + utility classes + reduced-motion block)

---

## T-002 — Spacing Fixes

### Goal
Fix four reported spacing/layout inconsistencies.

### Acceptance Criteria
- In `ListDetailPage`, the gap between the "Owner" chip row and the "Enable notifications" button is visually balanced (≈ 12 px, matching `--space-3`).
- In `AddItemSheet`, the gap between "Mehr anzeigen" toggle and the "Cancel / Add Item" button row is ≈ 8 px.
- In `ShareListSheet`, the "Send Invite" button and the success/error banner below it have a consistent gap (≈ 12 px).
- On mobile, when the "Add item" text input receives focus and the keyboard opens, the input scrolls into view automatically.

### Implementation

**Spacing in `ListDetailPage` (`detail-meta`):**
The `.detail-meta` div wraps the chip row and the push-notifications button with no gap. Add `display: flex; flex-direction: column; gap: var(--space-3);` (12 px) to `.detail-meta` in `index.css`.

**Spacing in `AddItemSheet` ("Mehr anzeigen" vs Cancel):**
The `add-item-more-btn` sits directly before the `button-row`. Reduce the `gap` in `.add-item-form` grid for this specific pairing or add `margin-bottom: 0` to `.add-item-more-btn` and adjust `.button-row` margin-top to `var(--space-2)` (8 px). Inspect computed gap; likely the `add-item-form` grid gap (e.g., 16 px) needs a targeted override between these two elements.

**Spacing in `ShareListSheet` (Send Invite → notice/error):**
Currently `.share-list-form` has `gap: 8px` and the banners sit below the form with no top margin. Add `margin-top: 8px` to `.detail-banner` inside the sheet context, or set a minimum `gap` between the form and banner in the sheet's column layout.

**Mobile keyboard scroll:**
In `AddItemSheet.jsx`, on the text `<input>`, add an `onFocus` handler that calls `event.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`. This ensures the input is visible when the iOS/Android soft keyboard resizes the viewport.

### Files to Change
- `frontend/src/index.css` (`.detail-meta`, `.share-list-form`, `.button-row` / `.add-item-form` spacing)
- `frontend/src/components/AddItemSheet.jsx` (`onFocus` scrollIntoView)

---

## T-003 — Mobile & Visual Fixes

### Goal
Fix the FAB clipping on narrow screens, the broken icon-browser search input shadow, the stray divider line above the search input, and the scrollbar flash on icon-browser collapse.

### Acceptance Criteria
- On any screen ≤ 375 px wide, the FAB is fully visible with at least 16 px right margin.
- The icon-search `eg-input` box-shadow/glow is fully visible (not clipped).
- No `border-top` divider appears above the icon-browser search field.
- Collapsing the icon browser ("Weniger anzeigen") does not cause a viewport-level scrollbar to flash.

### Implementation

**FAB clipping (`index.css`):**
Current rule: `right: calc(50% - 195px)`. On a 375 px viewport this evaluates to `−7.5 px`, pushing the FAB half off-screen.
Fix: `right: max(calc(50% - 195px), 16px)`. The `max()` CSS function ensures a minimum 16 px clearance on any narrow screen while preserving the centered layout on wider screens.

**Icon-browser search input shadow (`index.css`):**
The `.add-item-icon-browser-inner` element has `overflow: hidden`, which clips the `box-shadow` glow of the `eg-input` inside it.
Fix: Add `padding: 4px 4px 0` to `.add-item-icon-browser-inner` so the shadow has room, and compensate by adjusting the inner grid's gap if needed. Alternatively, change `overflow: hidden` to `overflow: clip` (CSS `overflow: clip` clips layout overflow but does not create a scroll container, so box-shadows can render outside the clip region via `overflow-clip-margin`). If `overflow: clip` is sufficient, set `overflow-clip-margin: 4px` to allow the glow to bleed out.

**Divider line above icon-browser search (`index.css`):**
Remove `border-top: 1px solid rgba(255, 255, 255, 0.05);` from `.add-item-icon-browser-inner`.

**Scrollbar flash on collapse (`index.css`):**
The collapse animation of the icon browser (grid-template-rows 1fr → 0fr) briefly causes overflow at the viewport level.
Fix: Add `overflow-x: hidden` to the `html` element or the `.bottom-sheet` container to prevent the transient horizontal/vertical overflow from producing a visible scrollbar. If this alone is insufficient, also add `contain: layout` to `.add-item-icon-browser`.

### Files to Change
- `frontend/src/index.css` (FAB `right`, icon-browser `overflow`, `border-top`, overflow-x)

---

## T-004 — Feature Additions

### Goal
Show the logged-in user in Info & Settings, add a loading state to "Send Invite", and show member-initials badges next to the "Owner" chip.

### Acceptance Criteria
- "Info & Settings" sheet displays the current user's display name and email.
- Clicking "Send Invite" disables the button and shows a spinner for the duration of the API call; re-enables on success or error.
- When the current user is the owner and there are non-owner members, a badge per member (initials, cyan/secondary color distinct from the purple owner chip) appears next to the "Owner" chip in the `detail-meta` area.

### Implementation

**Logged-in user in `InfoSheet.jsx`:**
`AuthContext` already exposes `user` (the authenticated user object). Destructure `user` from `useAuth()` in `InfoSheet`. Render a new `info-sheet-section` at the top of the sheet (below the logout button, above version) with two rows: display name (bold, `--text-primary`) and email (`--text-secondary`, smaller). Add corresponding CSS classes `.info-sheet-user-name` and `.info-sheet-user-email` to `index.css`.

**Send Invite loading state:**
- In `ListDetailPage.jsx`, add `isShareSubmitting` state (boolean, default false).
- In `handleShareSubmit`, set `isShareSubmitting(true)` before the API call, set `isShareSubmitting(false)` in a `finally` block.
- Pass `isShareSubmitting` to `<ShareListSheet>` as a new prop `isSubmitting`.
- In `ShareListSheet.jsx`, accept `isSubmitting` prop. On the `<button type="submit">`:
  - Add `disabled={isSubmitting}` attribute.
  - Render a small inline `<span className="share-invite-spinner" aria-hidden="true" />` before the label text when `isSubmitting` is true.
- Add `.share-invite-spinner` CSS (reuse existing `@keyframes spin` + styling from `add-item-preview-spinner` pattern) to `index.css`.

**Member initials badges in `ListDetailPage.jsx`:**

The badges must sit **inside** `.list-card-chips`, right-aligned on the same line as the "Owner" chip.

Move `<div className="detail-member-badges">` from its current position (separate row below `.list-card-chips`) into `.list-card-chips` as the last child:

```jsx
<div className="list-card-chips">
  <span className={list.is_owner ? "eg-chip-purple" : "eg-chip-cyan"}>
    {list.is_owner ? "Owner" : `Shared · ${list.owner_name ?? "another member"}`}
  </span>
  {list.is_pending_sync ? <span className="eg-chip-queued">Queued</span> : null}
  {visibleMemberBadges.length > 0 ? (
    <div className="detail-member-badges">
      {visibleMemberBadges.map((member) => (
        <span key={member.user_id} className="eg-chip-member-initial" title={member.display_name}>
          {getInitials(member.display_name)}
        </span>
      ))}
    </div>
  ) : null}
</div>
```

Add `margin-left: auto` to `.detail-member-badges` in `index.css` so the badge group is pushed to the right edge of the chip row, horizontally aligned with "Owner". Remove any `margin-top` that was previously used to separate it as a new row.

Update the test in `ListDetailPage.test.jsx` to assert `margin-left: auto` on `.detail-member-badges`.

### Files to Change
- `frontend/src/components/InfoSheet.jsx`
- `frontend/src/pages/ListDetailPage.jsx`
- `frontend/src/components/ShareListSheet.jsx`
- `frontend/src/index.css` (user info styles, spinner, member badge styles — add `margin-left: auto` to `.detail-member-badges`)
- `frontend/src/pages/ListDetailPage.test.jsx` (update badge CSS assertion)

---

## T-005 — Feature Removals

### Goal
Remove three unused UI elements: the Active/All Lists toggle, the stat chips on the start page, and the "Lists" bottom-nav tab.

### Acceptance Criteria
- The start page (`OverviewPage`) shows no toggle buttons ("Active" / "All Lists").
- The start page shows no "x lists" or "x shared" stat chips.
- The bottom navigation bar is absent from all pages (the bar itself and its safe-area padding are gone).
- No dead CSS rules or unused state remain for the removed elements.

### Implementation

**`OverviewPage.jsx`:**
- Remove the `view` state and `setView` setter.
- Remove the `displayLists` derivation (it was `const displayLists = lists;` — just use `lists` directly in the JSX).
- Remove the `sharedCount` derivation.
- Remove the entire `<div className="overview-chips">` block.
- Remove the entire `<div className="overview-toggle">` block.

**`BottomNav.jsx` + usage:**
- Remove `BottomNav` from wherever it is rendered in `App.jsx` or the layout wrapper.
- If `BottomNav` is no longer used anywhere, delete `frontend/src/components/ui/BottomNav.jsx` and remove its export from `frontend/src/components/ui/index.js`.

**`index.css`:**
- Remove `.overview-chips`, `.overview-chips .eg-chip-purple`, `.overview-toggle` rule blocks.
- Remove `.bottom-nav`, `.bottom-nav-tab`, `.bottom-nav-tab[aria-current="page"]`, `.bottom-nav-tab svg` rule blocks.
- Remove any `padding-bottom` on the page containers that was added to account for the bottom-nav height (check `.detail-page`, `.overview-page`, `.overview-content`).

### Files to Change
- `frontend/src/pages/OverviewPage.jsx`
- `frontend/src/components/ui/BottomNav.jsx` (delete if fully unused)
- `frontend/src/components/ui/index.js` (remove BottomNav export if deleted)
- `frontend/src/App.jsx` (remove `<BottomNav />` render)
- `frontend/src/index.css` (remove dead rule blocks)

---

## T-006 — AddItemSheet Layout Fixes (rework 2)

### Status of Previously Planned Fixes

The three fixes from the original T-006 plan are **already applied to `index.css`**:
- Bottom padding reduced to `var(--space-5)` (20 px) ✓
- `:not()` exclusion targets `.add-item-disclosure` ✓
- `.bottom-sheet--browser-open .add-item-disclosure` is a flex column with `flex: 1; min-height: 0` ✓

Despite those fixes both bugs persist. The actual root cause is `min-height: 0` missing from `.add-item-icon-browser-inner` in two places.

### Root Causes (revised)

**Bug 1 — Excessive spacing in compact mode ("Mehr anzeigen" not clicked)**

`.add-item-icon-browser` uses `display: grid; grid-template-rows: 0fr` to collapse its content. The CSS grid `0fr` collapse trick requires the **grid item** (`.add-item-icon-browser-inner`) to declare `min-height: 0`. Without it, the browser uses the item's intrinsic minimum height — which is the full height of the icon grid (`max-height: min(38vh, 20rem)` ≈ 330 px). The browser element stays ~330 px tall in the closed state, pushing the sheet content past `max-height` and making the whole sheet scrollable.

**Bug 2 — Icon grid not scrollable when browser is open ("Weniger anzeigen" visible)**

In browser-open mode `.add-item-icon-browser-inner` is a grid item inside `.add-item-icon-browser { display: grid; grid-template-rows: 1fr }`. Its row gets a definite height from `flex: 1; min-height: 0` on the browser. But without `min-height: 0` on `.add-item-icon-browser-inner` itself, the grid row cannot constrain the item below its intrinsic minimum height. The item expands to show all icons. The icon grid's `overflow-y: auto` has nothing to overflow against, so no scrollbar appears.

### Acceptance Criteria (unchanged)
- Before clicking "Mehr anzeigen": the gap below the Cancel/Add Item buttons is at most 20 px (matching the sheet's top padding).
- After clicking "Mehr anzeigen": the icon browser grid fills the available sheet height and is scrollable; the Cancel and Add Item buttons remain visible at the bottom.
- Closing the icon browser ("Weniger anzeigen") returns the sheet to its compact state without layout issues.

### Implementation — CSS only, `index.css`

**Fix A: Add `min-height: 0` to base `.add-item-icon-browser-inner` (fixes Bug 1)**

```css
/* before */
.add-item-icon-browser-inner {
  overflow: clip;
  overflow-clip-margin: 12px;
  display: grid;
  gap: 16px;
  padding: 4px 4px 0;
}

/* after */
.add-item-icon-browser-inner {
  overflow: clip;
  overflow-clip-margin: 12px;
  display: grid;
  gap: 16px;
  padding: 4px 4px 0;
  min-height: 0;
}
```

With `min-height: 0`, the `grid-template-rows: 0fr` row on `.add-item-icon-browser` can fully collapse to 0 px, removing the phantom ~330 px height in compact mode.

**Fix B: Add `min-height: 0` to `.bottom-sheet--browser-open .add-item-icon-browser-inner` (fixes Bug 2)**

```css
/* before */
.bottom-sheet--browser-open .add-item-icon-browser-inner {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: clip;
}

/* after */
.bottom-sheet--browser-open .add-item-icon-browser-inner {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: clip;
  min-height: 0;
}
```

With `min-height: 0`, the `grid-template-rows: 1fr` row on `.add-item-icon-browser` can constrain `.add-item-icon-browser-inner` to the available height. The icon grid (`flex: 1; overflow-y: auto`) then receives a bounded height and shows a scrollbar.

**Resulting flex chain when browser is open (corrected):**

```
.bottom-sheet (fixed, max-height, padding: 20px, overflow: hidden, flex column)
  .bottom-sheet-handle           (flex-shrink: 0)
  .bottom-sheet-title            (flex-shrink: 0)
  .add-item-form                 (flex: 1, min-height: 0, flex column, gap: 16px)
    .eg-field                    (flex-shrink: 0)
    .eg-field                    (flex-shrink: 0)
    .add-item-disclosure         (flex: 1, min-height: 0, flex column)
      .add-item-more-btn         (natural height)
      .add-item-icon-browser     (flex: 1, min-height: 0, grid — fills disclosure)
        .add-item-icon-browser-inner  (grid item, min-height: 0 → flex col — fills browser row)
          .eg-input              (flex-shrink: 0 — search field)
          .add-item-icon-browser-grid (flex: 1, overflow-y: auto — scrollable icons)
    .button-row.add-item-actions (flex-shrink: 0 — always visible at bottom)
```

### Files to Change
- `frontend/src/index.css` (2 targeted property additions — no JSX changes required)

---

## Validation (all tasks)

```
npm run lint
npm run build
npm test
```

Each task must pass all three before moving to `ready_for_review`.
