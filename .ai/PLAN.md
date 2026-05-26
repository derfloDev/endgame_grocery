# Plan

Status: **ready_for_implement**

Goal: Restore missing bottom spacing below the "Neu generieren" button in the API-key section.

## Background

T-005 set `.info-sheet-section { padding: var(--space-4) 0 0 }` (no bottom padding). The planned rework (add `padding-bottom` back to `.info-sheet-api-key` only) was not included in the T-005 commit. Result: no gap between the "Neu generieren" button and the divider line of the Logout section below it.

## Scope

One CSS change only. No JSX, translation, or test changes.

**File:** `frontend/src/components/InfoSheet/InfoSheet.module.css`

Before:
```css
.info-sheet-api-key {
  display: grid;
  gap: var(--space-3);
}
```

After:
```css
.info-sheet-api-key {
  display: grid;
  gap: var(--space-3);
  padding-bottom: var(--space-4);
}
```

## Acceptance Criteria

1. Visible bottom gap (≈ 16 px) between the "Neu generieren" / "Generate key" button and the divider line of the Logout section.
2. No other spacing changes to any other section.
3. `npm run lint`, `npm run build`, and `npm test` all pass.

## Validation

```
npm run lint
npm run build
npm test
```
