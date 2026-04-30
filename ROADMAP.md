# ROADMAP

Goal: polish the UI with animations, spacing/layout fixes, mobile fixes, visual corrections, small feature additions, and cleanup of unused features.

## Priority 1 — Animations

Objective: make list interactions feel smooth and responsive for local actions and real-time shared-user events.

- When an item is marked done in "Open items", it fades out and the card height shrinks smoothly.
- When an item is added back via "Recently used", it fades in.
- When an item is hard-deleted, it fades out.
- When a shared user adds or removes an item via SSE (`entry:created` / `entry:deleted`), the same fade-in / fade-out animations play.
- Affected files: `EntryRow.jsx`, `RecentlyUsedSection.jsx`, `ListDetailPage.jsx` (SSE handler via `useListEvents`), `index.css` / `tokens.css`.

## Priority 2 — Spacing & Layout Fixes

Objective: correct visual spacing inconsistencies reported across several sheets.

- Fix gap between "Owner" label and "Enable notifications" toggle in `ShareListSheet.jsx`.
- Fix gap between "Mehr anzeigen" and "Cancel" button in `RecentlyUsedSection.jsx`.
- Fix gap between "Send invite" button and "Invitation sent to …" confirmation message in `ShareListSheet.jsx`.
- On mobile: when the "+" FAB is tapped and the keyboard opens, the "Add item" input must remain visible (scroll/viewport fix in `AddItemSheet.jsx` + `ListDetailPage.jsx`).

## Priority 3 — Mobile & Visual Fixes

Objective: correct layout and visual defects on mobile and in the search UI.

- "+" FAB is clipped (half outside the screen) on both the start page and the shopping list page — fix positioning in `FAB.jsx` / page layouts.
- Search input shadow is broken — fix box-shadow in `index.css` or search-related component.
- Divider line above the search input must be removed — locate and delete the rule in `index.css` or the component.
- When "Weniger anzeigen" collapses the recently-used list, a scrollbar must not flash — add `overflow: hidden` or equivalent to the collapse animation in `RecentlyUsedSection.jsx`.

## Priority 4 — Feature Additions

Objective: surface missing information and improve interactive feedback.

- Display the currently logged-in user (name / email) inside "Infos & Settings" (`InfoSheet.jsx`, reads from `AuthContext`).
- After clicking "Send invite", disable the button and show a spinner until the API call resolves (`ShareListSheet.jsx`).
- When a list is shared, show a badge per shared member (initials, distinct color from owner) next to the "Owner" label in the list detail view (`ListDetailPage.jsx` or `ShareListSheet.jsx`).

## Priority 5 — Feature Removals

Objective: remove unused / unwanted UI elements to reduce visual clutter.

- Remove "Active" and "All Lists" filter tabs from the start page (`OverviewPage.jsx`).
- Remove "x lists" and "x shared" stat badges from the start page (`OverviewPage.jsx` / `ListCardHome.jsx`).
- Remove the "Lists" tab from the bottom navigation (`BottomNav.jsx`).
