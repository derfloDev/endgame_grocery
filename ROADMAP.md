# ROADMAP

Goal: Apply the Endgame Grocery design system — dark neon Marvel-inspired theme — to the full frontend. Every existing user-facing screen gets the new visual identity. New UI patterns from the design (bottom nav, FAB, bottom sheets, swipe-to-delete, neon animations) are implemented where backend features already exist to support them. Design elements with no existing backend feature are omitted.

## Constraints

- Frontend only (React + Vite). No new backend routes.
- Squad tab: no backend sharing-members feature surfaced in the UI yet → tab omitted from bottom nav.
- Category grouping: no backend support → not implemented; entries remain a flat list.
- Progress bars on the overview require per-list entry counts which the current lists API does not return → omitted from list cards.
- Search: client-side, filtering across already-fetched lists by name and owner.

## Priority 1 — Design tokens & app shell

Objective: Replace the current light/warm global styles with the Endgame Grocery dark-neon design system and rebuild the app shell to a mobile-first layout.

- Install and configure Google Fonts: Orbitron, Exo 2, JetBrains Mono.
- Write full CSS design token file (`colors_and_type.css` port) as `frontend/src/styles/tokens.css`.
- Replace `index.css` body/root/shell styles with dark theme (`#080B1C` bg, neon palette, new type scale).
- Copy `endgame_grocery_logo.png` into `frontend/src/assets/`.
- Rebuild `ProtectedLayout` in `App.jsx`: mobile-first 390 px canvas, dark bg, `BottomNav` (Lists + Search tabs), no more `hero-card`.
- Add `/search` route to the router.

## Priority 2 — Shared UI component library

Objective: Create reusable Endgame Grocery components that all screens use.

- `Icon` component (inline Lucide-style SVG paths subset).
- `TopBar` component (sticky, title + optional back button + action slots).
- `FAB` (floating action button, neon gradient, 56 px, fixed position).
- `BottomNav` (Lists / Search tabs, active neon-cyan state, fixed bottom).
- `EmptyState`, `LoadingState` (shimmer), `ErrorState` ("Mission Failed") components.
- Button variants (primary, secondary, ghost, danger) as CSS classes + optional React wrapper.
- Input, card, chip/badge CSS classes from the design system.
- Bottom-sheet overlay component (shared by Add Item, New List, and Add Member flows).

## Priority 3 — Auth pages

Objective: Apply the dark design to Login and Register screens.

- Dark `auth-layout` + `auth-card` (bg-surface, neon border, `28px` radius).
- Logo + "ENDGAME GROCERY" Orbitron header on both pages.
- Neon-styled form inputs and primary button.
- Error banners using design-system `--color-error`.

## Priority 4 — Overview page (Home screen)

Objective: Redesign the lists overview to match the HomeScreen prototype.

- "ENDGAME / GROCERY" Orbitron gradient header with logo.
- Summary chips (list count, shared count).
- Active / All Lists toggle filter.
- `ListCardHome`: dark card with neon border, list name, owner/shared chip, "Queued" sync badge.
- `NewListSheet`: bottom sheet with name input and Create/Cancel actions (replaces inline form).
- FAB triggers `NewListSheet`.
- Empty state, loading shimmer, error state.
- Logout action in header (top-right icon button).

## Priority 5 — List detail page

Objective: Redesign the single-list view to match the ListScreen prototype.

- `TopBar` with back arrow and list name.
- "Add item" as bottom sheet (`AddItemSheet`) triggered by FAB — replaces inline form.
- Entry items as neon-styled row cards (check circle, text, pending-sync badge).
- Swipe-to-delete on entry rows (touch `touchstart`/`touchmove`/`touchend`, reveal red delete zone at 80 px threshold).
- Open items section + "Done" collapsible section with count badge.
- Sharing panel (owner only): restyled as inline neon section below entries; share-by-email input + member list with Revoke buttons.
- Edit-in-place for entry text: tap-to-edit inline input.
- Error/loading/empty states.

## Priority 6 — Search page

Objective: Implement a Search screen accessible via the bottom nav.

- New `SearchPage` component at `/search`.
- Search input with neon style, auto-focused on enter.
- Client-side filtering of fetched lists by name (case-insensitive substring).
- Results displayed as `ListCardHome` cards (tapping navigates to list detail).
- Empty-search and no-results states.
- Shares the same `lists` data already fetched; no extra API calls.
