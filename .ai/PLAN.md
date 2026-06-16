# Plan

Status: **ready**

Goal: Fix the OverviewPage topbar so the app name ("ENDGAME Grocery") and the settings
button are both fully visible on all screen sizes (≥ 320 px).

## Root Cause

The first fix (T-001 initial) added `flex-shrink: 0` to `.overview-actions` to keep the
settings button visible. But `.overview-actions` still contains the sort-select
(max-width 150 px), so the container's max-content width is ~244 px. On a 320 px screen
(~288 px usable) that leaves only ~30 px for the brand title → text clips after "END".

The structural tension: you cannot make `.overview-actions` both "never shrink" AND
"contain a wide sort control" without crowding the brand title.

## Solution: Structural separation

Move the sort-select out of `.overview-actions` into its own `.overview-sort-row` sibling
element that sits below the brand row.

After the change the topbar DOM looks like:

```
.overview-topbar
├── .overview-brand              (flex, space-between)
│   ├── .overview-brand-left    (flex-shrink: 1, min-width: 0)
│   │   ├── .overview-brand-title
│   │   └── .overview-brand-sub
│   └── .overview-actions       (flex-shrink: 0, ~88 px: logo + button)
│       ├── img.overview-logo
│       └── button[settings]
└── .overview-sort-row           (flex, justify-content: flex-end, mb: 0)
    ├── label (visually-hidden)
    └── select.overview-sort-select
```

## Acceptance Criteria

- App name "ENDGAME Grocery" is fully visible (no clipping) on screens ≥ 320 px.
- Settings button is visible in the top-right area on screens ≥ 320 px.
- Sort dropdown sits below the brand row, right-aligned, on all screen sizes.
- No visual regression on desktop (≥ 481 px).
- `npm run lint`, `npm run build`, and `npm test` all pass.

## Implementation Phases

### Phase 1 — Restructure JSX (`OverviewPage.tsx`)

Move the `<div className={styles["overview-sort-control"]}>` block (label + select) out of
`.overview-actions` and into a new sibling `<div className={styles["overview-sort-row"]}>`
placed after `.overview-brand` but still inside `.overview-topbar`.

Result:

```tsx
<div className={styles["overview-topbar"]}>
  <div className={styles["overview-brand"]}>
    <div className={styles["overview-brand-left"]}>
      <div className={`eg-gradient-text eg-orbitron ${styles["overview-brand-title"]}`}>
        {t("app.brandMain")}
      </div>
      <div className={styles["overview-brand-sub"]}>{t("app.brandSub")}</div>
    </div>
    <div className={styles["overview-actions"]}>
      <img alt={t("app.brandName")} className={styles["overview-logo"]} src={logo} />
      <button aria-label={t("settings.open")} className="eg-icon-btn" type="button"
              onClick={() => setShowInfo(true)}>
        <Icon name="settings" color="var(--text-secondary)" size={18} />
      </button>
    </div>
  </div>
  <div className={styles["overview-sort-row"]}>
    <label className="visually-hidden" htmlFor="overview-sort">
      {t("overview.sortLabel")}
    </label>
    <select
      id="overview-sort"
      className={styles["overview-sort-select"]}
      value={sortMode}
      onChange={(event) => handleSortChange(event.target.value as OverviewSortMode)}
    >
      <option value="created_asc">{t("overview.sortCreatedAsc")}</option>
      <option value="name_asc">{t("overview.sortNameAsc")}</option>
      <option value="activity_desc">{t("overview.sortActivityDesc")}</option>
    </select>
  </div>
</div>
```

### Phase 2 — Update CSS (`OverviewPage.module.css`)

1. **`.overview-brand`**: remove `margin-bottom: 12px` (spacing now comes from
   `.overview-sort-row` below, or keep a smaller gap of 8 px).

2. **`.overview-actions`**: keep `flex-shrink: 0`; remove any sort-related rules. The
   `flex-wrap`, `justify-content: flex-end`, etc. are no longer needed.

3. **`.overview-sort-control`**: rule can be removed entirely (element no longer exists).

4. **Add `.overview-sort-row`**:
   ```css
   .overview-sort-row {
     display: flex;
     justify-content: flex-end;
     margin-bottom: 12px;
   }
   ```

5. **Remove the `@media (max-width: 480px)` block** entirely — the layout now works
   correctly without mobile-specific overrides for the brand/actions/sort elements.
   If other mobile overrides exist, keep only what is still needed.

6. **`.overview-brand-left`** stays as-is (`min-width: 0; flex-shrink: 1`).

### Phase 3 — Validation

```
npm run lint
npm run build
npm test
```

## Files to Change

| File | Change |
|------|--------|
| `frontend/src/pages/OverviewPage/OverviewPage.tsx` | Move sort-control markup out of `.overview-actions` into a new `.overview-sort-row` sibling |
| `frontend/src/pages/OverviewPage/OverviewPage.module.css` | Add `.overview-sort-row`; remove `.overview-sort-control`; remove/simplify `@media (max-width: 480px)` block; adjust `.overview-brand` margin; clean up `.overview-actions` |

## Validation

- `npm run lint`
- `npm run build`
- `npm test`
