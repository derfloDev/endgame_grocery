# Plan

Status: **ready_for_implement**

Goal: Remove the divider line between the Logout button and the meta footer (Version / License / Donate).

## Background

After T-003 the Logout section has `info-sheet-section--footer` (→ `border-top` above the button) and the meta wrapper also has `info-sheet-section--footer` (→ `border-top` below the button). The user wants only the top divider above Logout; the line below it should be removed.

## Scope

One JSX change only. No CSS changes, no translation changes, no test changes.

**File:** `frontend/src/components/InfoSheet/InfoSheet.tsx`

**Change:** Remove `info-sheet-section--footer` from the meta-footer wrapper `<div>`.

Before (line ~169):
```jsx
<div className={`${styles["info-sheet-section"]} ${styles["info-sheet-section--footer"]}`}>
  <div className={styles["info-sheet-meta"]}>   {/* Version */}
```

After:
```jsx
<div className={styles["info-sheet-section"]}>
  <div className={styles["info-sheet-meta"]}>   {/* Version */}
```

## Acceptance Criteria

1. No divider line between the Logout button and the Version row.
2. The divider above the Logout button (from T-003) is still present.
3. `npm run lint`, `npm run build`, and `npm test` all pass.

## Validation

```
npm run lint
npm run build
npm test
```
