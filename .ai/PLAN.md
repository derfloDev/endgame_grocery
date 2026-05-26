# Plan

Status: **ready_for_implement** (T-005 rework — additional constraint added after initial review)

Goal: Remove excessive bottom padding from most InfoSheet sections, but preserve it below the API-Key section ("Neu generieren" button).

## Background

`.info-sheet-section` originally had `padding: var(--space-4) 0 1rem`. T-005 removed the bottom padding globally (`padding: var(--space-4) 0 0`). The user confirmed the space below "Neu generieren" (the Regenerate button in the API-key section) should be kept.

## Scope

CSS only. No JSX, translation, or test changes.

**File:** `frontend/src/components/InfoSheet/InfoSheet.module.css`

### Change 1 — already in T-005 implementation, keep as-is
```css
.info-sheet-section {
  padding: var(--space-4) 0 0;   /* bottom padding removed globally */
}
```

### Change 2 — new, add to `.info-sheet-api-key`
Restore the bottom spacing specifically for the API-key section:

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

1. No visible bottom gap below the language toggle, username block, and logout button.
2. Visible bottom gap (≈ 16 px) is preserved below the API-key section (after the "Neu generieren" / "Generate key" button).
3. `npm run lint`, `npm run build`, and `npm test` all pass.

## Validation

```
npm run lint
npm run build
npm test
```
