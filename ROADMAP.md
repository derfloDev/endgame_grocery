# ROADMAP

Goal: Extend the icon system with additional tabler/lucide icons and lay the foundation for custom (hand-crafted) SVG icons.

## Priority 1 — Add missing tabler/lucide icons ✅ done (T-001)

Icons added: `IconPaperBag`, `IconGrape`, `IconCannabis`, `IconBeef`, `IconBean`, `BicepsFlexed`.

## Priority 2 — Custom icon infrastructure + Kornflakes example ✅ done (T-002 / T-003)

Custom icons stored as `.svg` files under `frontend/src/assets/icons/custom/`, imported via `vite-plugin-svgr`, normalized through `normalizeCustomIcon()`, registered in `ICON_REGISTRY` with `Custom` prefix.

## Priority 3 — Additional custom icons: grocery & hygiene batch ✅ done (T-004)

CustomGarlic, CustomHummus, CustomDentalFloss, CustomToothpaste, CustomCottonPads, CustomPasta.

## Priority 4 — Icon suggestion quality (T-005)

Objective: Make the icon suggestion system find the right icon for any common input — including synonyms, regional variants, compound words, and brand names.

- Register all existing custom icons (T-002–T-004) in `iconDatabase.js` so they are suggested.
- Redirect "garlic" and "pasta" DB entries to the dedicated custom icons.
- Enrich every existing `iconDatabase.js` entry across all categories with additional German and English tags (target ≥ 5 tags per entry).

## Priority 5 — Expanded icon set: clothing, fruit, hygiene & misc (T-006)

Objective: Cover product categories not yet represented in the icon browser.

### Group A — tabler/lucide (implementer verifies availability; custom SVG fallback if absent)

| Item | Candidate | Registry key |
|---|---|---|
| Socken | tabler `IconSock` | `IconSock` |
| Hose | tabler `IconPants` | `IconPants` |
| Schuhe | tabler `IconShoe` | `IconShoe` |
| Ananas | tabler `IconPineapple` | `IconPineapple` |
| Wassermelone | lucide `Watermelon` | `Watermelon` |
| Feuerzeug | tabler `IconFlame` | `IconFlame` |
| Konservendose | tabler `IconCan` | `IconCan` |

### Group B — Custom SVG icons

| Item | SVG file | Registry key |
|---|---|---|
| Wattestäbchen | `cottonSwabs.svg` | `CustomCottonSwabs` |
| Feuchtes Klopapier | `wetWipes.svg` | `CustomWetWipes` |
| Interdental Sticks | `interdentalSticks.svg` | `CustomInterdentalSticks` |
| Creme Tube | `creamTube.svg` | `CustomCreamTube` |
| Creme Tiegel | `creamJar.svg` | `CustomCreamJar` |
| Mango | `mango.svg` | `CustomMango` |
| Kiwi | `kiwi.svg` | `CustomKiwi` |
| Pfirsich | `peach.svg` | `CustomPeach` |
| Pflaume | `plum.svg` | `CustomPlum` |
| Blaubeeren | `blueberries.svg` | `CustomBlueberries` |
| E-Liquid / Vape | `eLiquid.svg` | `CustomELiquid` |

### Group C — DB entries only (existing icons, no new registry key)

| Item | Icon to use | Action |
|---|---|---|
| T-Shirt (Kleidung) | `IconShirt` | Add clothing DB entry |
| Knopfzellen | `IconBattery` | Add DB entry |

All T-006 icons receive `iconDatabase.js` entries with German + English tags within the same task.
