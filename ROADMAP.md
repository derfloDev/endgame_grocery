# ROADMAP

Goal: Extend the icon system with additional tabler/lucide icons and lay the foundation for custom (hand-crafted) SVG icons.

## Priority 1 — Add missing tabler/lucide icons

Objective: Make all requested grocery-relevant icons available in the icon selector.

Icons to add (not yet in registry):

| Requested name | Source | Registry key |
|---|---|---|
| paper-bag | tabler | `IconPaperBag` |
| grape | tabler (primary) | `IconGrape` |
| cannabis | tabler (primary) | `IconCannabis` |
| beef | tabler (primary) | `IconBeef` |
| bean | tabler (primary) | `IconBean` |
| biceps-flexed | lucide (no tabler equivalent) | `BicepsFlexed` |

Already registered (no action required): `chef-hat`, `soup`, `wheat`, `bowl-spoon`, `ice-cream`, `salt`.

For each icon: if the tabler variant does not exist in the installed version, fall back to the lucide equivalent wrapped in `fromLucide()`.

## Priority 2 — Custom icon infrastructure + Kornflakes example

Objective: Establish a pattern that lets developers add hand-crafted SVG icons alongside tabler/lucide icons, and ship two Kornflakes icons as the first working examples.

- A `fromCustomSVG()` factory in `frontend/src/data/customIcons.js` that produces React components with the same prop surface as tabler/normalized-lucide icons (`size`, `stroke`/`strokeWidth`, `color`).
- Custom icon definitions live in `customIcons.js`; each icon is a named export and registered in `ICON_REGISTRY` with a `Custom` prefix.
- Two example icons:
  - `CustomKornflakesBowl` — a bowl with cereal flakes (hand-drawn SVG paths)
  - `CustomKornflakesBox`  — a cereal-box silhouette (hand-drawn SVG paths)
- Both appear in the icon browser like any other icon.
