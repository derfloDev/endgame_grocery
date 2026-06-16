# ROADMAP

Goal: Fix the OverviewPage topbar so both the settings button AND the full app name are
always visible on all mobile screen sizes.

## Priority 1

Objective: Stable topbar layout on narrow phones (≥ 320 px viewport).

- **Problem 1 (original):** Settings button was pushed off-screen on narrow screens because
  the brand title div had no flex-shrink constraint.
- **Problem 2 (regression from P1 fix):** Adding `flex-shrink: 0` to `.overview-actions`
  and keeping the sort-select inside the same container causes the actions div to claim its
  full max-content width (~244 px: sort + logo + button + gaps), leaving only ~30 px for
  the brand title → title clips after "END".

**Root cause of regression:**  
The sort-select lives inside `.overview-actions`, which must be `flex-shrink: 0` to keep
the settings button visible. These two requirements are fundamentally in conflict when the
sort-select adds ~150 px to the container width.

**Chosen fix: structural separation of the sort control**  
Move the sort-select out of `.overview-actions` into a dedicated `.overview-sort-row` div
that sits below the brand row. The brand row then only contains:
  - Left: `.overview-brand-left` (title + subtitle)
  - Right: `.overview-actions` (logo + settings button only, ~88 px)

This removes the conflict entirely:
- Brand title always has ample horizontal space.
- Settings button is always visible (actions container is small and `flex-shrink: 0`).
- Sort control occupies its own row, right-aligned.
- The `flex-wrap: wrap-reverse` mobile hack is no longer needed.
