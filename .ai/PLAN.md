# Plan

Status: **ready_for_implement**

Goal: Add a single top-divider line above the Logout button.

## Background

After T-002 the Logout section has no visual separator above it. The user requested a single thin divider line between the API-Key section and the Logout button. The `--footer` modifier class already carries `border-top: 1px solid rgba(255, 255, 255, 0.08)` — it just needs to be applied to the logout `<div>` as well.

## Scope

One JSX change only. No CSS changes, no translation changes, no test changes.

**File:** `frontend/src/components/InfoSheet/InfoSheet.tsx`

**Change:** Add `info-sheet-section--footer` to the logout section's `className`.

Before:
```jsx
<div className={styles["info-sheet-section"]}>
  <button className={`eg-btn eg-btn-danger ${styles["info-sheet-logout"]}`} …>
```

After:
```jsx
<div className={`${styles["info-sheet-section"]} ${styles["info-sheet-section--footer"]}`}>
  <button className={`eg-btn eg-btn-danger ${styles["info-sheet-logout"]}`} …>
```

## Acceptance Criteria

1. A single thin divider line is visible above the Logout button.
2. No other visual changes to any other section.
3. `npm run lint`, `npm run build`, and `npm test` all pass.

## Validation

```
npm run lint
npm run build
npm test
```
