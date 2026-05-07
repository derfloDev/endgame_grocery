# ROADMAP

Goal: Extend the icon system with additional tabler/lucide icons and lay the foundation for custom (hand-crafted) SVG icons.

## Priority 1 — Add missing tabler/lucide icons ✅ done

Objective: Make all requested grocery-relevant icons available in the icon selector.

Icons added: `IconPaperBag`, `IconGrape`, `IconCannabis`, `IconBeef`, `IconBean`, `BicepsFlexed`.

Already registered (no action required): `chef-hat`, `soup`, `wheat`, `bowl-spoon`, `ice-cream`, `salt`.

## Priority 2 — Custom icon infrastructure + Kornflakes example (reworked)

Objective: Establish a pattern that lets developers add hand-crafted SVG icons alongside tabler/lucide icons, and ship two Kornflakes icons as the first working examples.

**Approach (T-003, replaces T-002 implementation):**

- Custom icons are stored as `.svg` files on disk under `frontend/src/assets/icons/custom/`.
- `vite-plugin-svgr` is installed and configured so SVG files can be imported as React components via the `?react` suffix.
- A `normalizeCustomIcon(SvgComponent)` wrapper in `frontend/src/data/customIcons.js` adapts the vite-plugin-svgr component to the same prop surface used by tabler/lucide icons (`size`, `stroke`/`strokeWidth`, `color`).
- `customIcons.js` imports each `.svg?react` file, wraps it, and exports the result with a `Custom` prefix.
- Exports are registered in `ICON_REGISTRY` exactly as before — the registry and icon browser require no further changes.
- Two example SVG files:
  - `kornflakesBowl.svg` — a bowl with cereal flakes
  - `kornflakesBox.svg` — a cereal-box silhouette
- Both appear in the icon browser at any size with `currentColor` stroke.
