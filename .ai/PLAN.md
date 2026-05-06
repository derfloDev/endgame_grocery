# Plan

Status: **ready_for_implement**

Goal: Extend the icon registry with additional tabler/lucide icons and introduce a custom SVG icon system with two Kornflakes example icons.

## Scope

- T-001: Add six missing tabler/lucide icons to `ICON_REGISTRY`
- T-002: Build `fromCustomSVG()` infrastructure in a new `customIcons.js` file and register two Kornflakes custom icons

## Acceptance Criteria

- T-001: All six icons (`IconPaperBag`, `IconGrape`, `IconCannabis`, `IconBeef`, `IconBean`, `BicepsFlexed`) appear in the icon browser and are selectable.
- T-002: `CustomKornflakesBowl` and `CustomKornflakesBox` appear in the icon browser; they render correctly at `size=22` and `size=32`; stroke color follows `currentColor`.
- `npm run lint` and `npm run build` pass with no new errors.

---

## T-001 — Add missing tabler/lucide icons

### Files to change

| File | Change |
|---|---|
| `frontend/src/data/iconRegistry.js` | Add tabler imports + lucide import + registry entries |

### Implementation steps

1. **Verify tabler icon names** against `node_modules/@tabler/icons-react` exports:
   - `IconPaperBag`, `IconGrape`, `IconCannabis`, `IconBeef`, `IconBean`
   - If a name is absent from the installed version, use the lucide equivalent wrapped in `fromLucide()`.

2. **Add to the tabler import block** (alphabetical order within the block):
   ```js
   IconBean,
   IconBeef,
   IconCannabis,
   IconGrape,
   IconPaperBag,
   ```

3. **Add to the lucide import block**:
   ```js
   BicepsFlexed,
   ```
   (+ any tabler fallbacks that didn't resolve)

4. **Add to `ICON_REGISTRY`** (maintain alphabetical order):
   ```js
   BicepsFlexed: fromLucide(BicepsFlexed),
   IconBean,
   IconBeef,
   IconCannabis,
   IconGrape,
   IconPaperBag,
   ```

5. Run `npm run lint` and `npm run build` to confirm no import errors.

---

## T-002 — Custom icon infrastructure + Kornflakes examples

### Files to create / change

| File | Action |
|---|---|
| `frontend/src/data/customIcons.js` | **Create** — factory + Kornflakes definitions |
| `frontend/src/data/iconRegistry.js` | **Extend** — import custom icons, register them |

### Implementation steps

#### Step 1 — Create `customIcons.js`

The file has three responsibilities:

1. **`fromCustomSVG(def)` factory** — accepts a definition object and returns a React component compatible with the tabler/lucide prop surface:

   ```js
   // def shape:
   // {
   //   displayName: string,
   //   viewBox?: string,          // default "0 0 24 24"
   //   elements: ReactElement[]   // pre-built <path>, <circle>, etc.
   // }
   function fromCustomSVG({ displayName, viewBox = "0 0 24 24", elements }) {
     function CustomIcon({ size = 24, stroke, strokeWidth, color = "currentColor", ...rest }) {
       return createElement("svg", {
         xmlns: "http://www.w3.org/2000/svg",
         width: size,
         height: size,
         viewBox,
         fill: "none",
         stroke: color,
         strokeWidth: stroke ?? strokeWidth ?? 1.5,
         strokeLinecap: "round",
         strokeLinejoin: "round",
         ...rest
       }, ...elements);
     }
     CustomIcon.displayName = displayName;
     return CustomIcon;
   }
   ```

2. **`CustomKornflakesBowl`** — bowl with cereal flakes:
   - A wide, shallow bowl (arc/ellipse at bottom)
   - 3–4 small irregular polygons or curved shapes floating above the bowl to represent flakes
   - All stroked paths on a 24×24 grid

3. **`CustomKornflakesBox`** — cereal-box silhouette:
   - A tall rectangle (the box body)
   - A small trapezoid or angled top
   - One or two simple decorative lines on the front to suggest a label
   - All stroked paths on a 24×24 grid

4. **Named exports**: `export const CustomKornflakesBowl = fromCustomSVG({...})` and `export const CustomKornflakesBox = fromCustomSVG({...})`.

#### Step 2 — Register in `iconRegistry.js`

```js
import { CustomKornflakesBowl, CustomKornflakesBox } from "./customIcons.js";

// In ICON_REGISTRY (alphabetical):
CustomKornflakesBox,
CustomKornflakesBowl,
```

#### Step 3 — Validate display name formatting

`formatIconName("CustomKornflakesBowl")` should produce `"Kornflakes Bowl"` (or similar readable label).
The existing `formatIconName` strips a leading `Icon` prefix but **not** `Custom`.
Add `Custom` to the strip logic:

```js
const stripped = name.startsWith("Icon")
  ? name.slice(4)
  : name.startsWith("Custom")
    ? name.slice(6)
    : name;
```

Update the JSDoc / inline comment for `formatIconName` to document the `Custom` prefix handling.

---

## Validation

```
npm run lint
npm run build
npm test
```
