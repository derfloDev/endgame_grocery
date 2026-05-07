# Plan

Status: **ready_for_implement**

Goal: Extend the icon registry with additional tabler/lucide icons and introduce a custom SVG icon system with two Kornflakes example icons.

## Scope

- T-001: Add six missing tabler/lucide icons to `ICON_REGISTRY` ✅ done
- T-002: Initial custom icon infrastructure (JS-embedded paths) ✅ done — superseded by T-003
- T-003: Refactor custom icon system to use filesystem SVG files via `vite-plugin-svgr`

## Acceptance Criteria

- T-003: `CustomKornflakesBowl` and `CustomKornflakesBox` render correctly at `size=22` and `size=32` with `currentColor` stroke; both appear in the icon browser; the icons are defined as `.svg` files under `frontend/src/assets/icons/custom/`; `npm run lint`, `npm run build`, and `npm test` pass with no new errors.

---

## T-001 — Add missing tabler/lucide icons ✅ done

_(see HANDOFF.md for implementation details)_

---

## T-002 — Custom icon infrastructure (JS-embedded) ✅ done — superseded by T-003

_(see HANDOFF.md for implementation details)_

---

## T-003 — Refactor custom icons to filesystem SVG files

### Context

T-002 shipped custom icons with SVG paths embedded in JS. T-003 replaces that approach: each custom icon is a proper `.svg` file on disk, imported as a React component via `vite-plugin-svgr`.

### Files to create / change

| File | Action |
|---|---|
| `frontend/package.json` | **Extend** — add `vite-plugin-svgr` to devDependencies |
| `frontend/vite.config.js` | **Extend** — register `svgr()` plugin |
| `frontend/src/assets/icons/custom/kornflakesBowl.svg` | **Create** — bowl with cereal flakes SVG |
| `frontend/src/assets/icons/custom/kornflakesBox.svg` | **Create** — cereal-box silhouette SVG |
| `frontend/src/data/customIcons.js` | **Rewrite** — replace `fromCustomSVG()` factory with `normalizeCustomIcon()` wrapper; import SVG files via `?react` |
| `frontend/src/data/iconRegistry.js` | **No change required** — imports/registry entries from T-002 remain valid |
| `frontend/src/data/iconRegistry.test.js` | **Update** — adjust any tests that relied on the old JS-path factory behaviour |

### Implementation steps

#### Step 1 — Install and configure `vite-plugin-svgr`

```bash
npm install --save-dev vite-plugin-svgr --workspace frontend
```

In `frontend/vite.config.js`, add the plugin:

```js
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [
    react(),
    svgr(),          // enables *.svg?react imports
    VitePWA({...}),
  ],
  // ...rest unchanged
});
```

#### Step 2 — Create SVG files

Location: `frontend/src/assets/icons/custom/`

Both files must follow these conventions so the normalizer can control appearance:
- `viewBox="0 0 24 24"`, no `width`/`height` attributes on the `<svg>` root
- `fill="none"` on the root `<svg>`
- `stroke="currentColor"` on all stroked paths/shapes
- `stroke-width` omitted on elements (controlled by the wrapper at render time)
- `stroke-linecap="round"` and `stroke-linejoin="round"` on the root or each element

**`kornflakesBowl.svg`** — a wide shallow bowl with 3–4 small flake shapes floating inside:
- Bowl: a wide U-shaped arc or ellipse segment near the bottom of the canvas
- Flakes: 3–4 small irregular quadrilaterals or curved diamond shapes above the bowl centre
- All on 24×24 grid

**`kornflakesBox.svg`** — a cereal-box silhouette:
- Box body: a tall rounded rectangle occupying most of the canvas height
- Angled/folded top: two lines forming a closed trapezoid flap on top of the box
- Label area: one or two short horizontal lines in the lower third of the box front
- All on 24×24 grid

#### Step 3 — Rewrite `customIcons.js`

Replace the old `fromCustomSVG()` factory (which accepted JS `elements` arrays) with `normalizeCustomIcon()`, which wraps a vite-plugin-svgr React component:

```js
import { createElement } from "react";
import KornflakesBowlSvg from "../assets/icons/custom/kornflakesBowl.svg?react";
import KornflakesBoxSvg  from "../assets/icons/custom/kornflakesBox.svg?react";

/**
 * Wraps a vite-plugin-svgr component so it accepts the same props as
 * tabler/lucide icons: size, stroke, strokeWidth, color.
 */
function normalizeCustomIcon(SvgComponent, displayName) {
  function CustomIcon({ size = 24, stroke, strokeWidth, color = "currentColor", ...rest }) {
    return createElement(SvgComponent, {
      width: size,
      height: size,
      stroke: color,
      strokeWidth: stroke ?? strokeWidth ?? 1.5,
      ...rest,
    });
  }
  CustomIcon.displayName = displayName;
  return CustomIcon;
}

export const CustomKornflakesBowl = normalizeCustomIcon(KornflakesBowlSvg, "CustomKornflakesBowl");
export const CustomKornflakesBox  = normalizeCustomIcon(KornflakesBoxSvg,  "CustomKornflakesBox");
```

#### Step 4 — Update tests

In `frontend/src/data/iconRegistry.test.js`:
- Remove any test that directly tested the old `fromCustomSVG()` factory signature.
- Verify that `ICON_REGISTRY.CustomKornflakesBowl` and `ICON_REGISTRY.CustomKornflakesBox` still resolve correctly via `resolveIconName()`.
- Verify `formatIconName("CustomKornflakesBowl")` returns `"Kornflakes Bowl"` (the `Custom`-prefix strip from T-002 remains valid).

#### Step 5 — Validate

```bash
npm run lint
npm run build
npm test
```

Confirm: no new lint errors; build does not warn about unresolved SVG imports; all registry tests pass.

---

## Validation

```
npm run lint
npm run build
npm test
```
