# Plan

Status: **ready_for_implement**

Goal: Extend the icon registry with additional tabler/lucide icons and introduce a custom SVG icon system with two Kornflakes example icons.

## Scope

- T-001: Add six missing tabler/lucide icons to `ICON_REGISTRY` ✅ done
- T-002: Initial custom icon infrastructure (JS-embedded paths) ✅ done — superseded by T-003
- T-003: Refactor custom icon system to use filesystem SVG files via `vite-plugin-svgr` ✅ done
- T-004: Add six new custom SVG icons (Garlic, Hummus, DentalFloss, Toothpaste, CottonPads, Pasta) ✅ done
- T-006: Expanded icon set — seven tabler/lucide candidates + eleven custom SVGs (registry only, no DB entries)
- T-005: Comprehensive `iconDatabase.js` enrichment — covers all icons from T-001–T-006; runs after T-006

## Acceptance Criteria

- T-001–T-004: ✅ done
- T-006: All new icons appear in the icon browser; tabler/lucide icons imported correctly (custom SVG fallback where absent); all eleven custom SVGs render at `size=22` and `size=32` with `currentColor` stroke; `npm run lint`, `npm run build`, and `npm test` pass.
- T-005 (depends on T-006 being done): All icons from T-001–T-006 have DB entries and appear as suggestions; "garlic"/"knoblauch" resolves to `CustomGarlic`; "pasta"/"nudeln" resolves to `CustomPasta`; "grapes" resolves to `IconGrape`; every existing entry has ≥ 5 tags; `npm run lint`, `npm run build`, and `npm test` pass.

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

---

## T-004 — Add six new custom SVG icons (grocery & hygiene batch)

### Context

T-003 established the pattern: SVG file on disk → `?react` import → `normalizeCustomIcon()` wrapper → `ICON_REGISTRY` entry. T-004 adds six more icons following the same pattern exactly.

### SVG file conventions (same as T-003)

- `viewBox="0 0 24 24"`, no `width`/`height` on the `<svg>` root
- `fill="none"` on the root `<svg>`
- `stroke="currentColor"` on all stroked elements
- `stroke-width` omitted on individual elements (set by the normalizer at render time)
- `stroke-linecap="round"` and `stroke-linejoin="round"` on root or each element

### Files to create / change

| File | Action |
|---|---|
| `frontend/src/assets/icons/custom/garlic.svg` | **Create** |
| `frontend/src/assets/icons/custom/hummus.svg` | **Create** |
| `frontend/src/assets/icons/custom/dentalFloss.svg` | **Create** |
| `frontend/src/assets/icons/custom/toothpaste.svg` | **Create** |
| `frontend/src/assets/icons/custom/cottonPads.svg` | **Create** |
| `frontend/src/assets/icons/custom/pasta.svg` | **Create** |
| `frontend/src/data/customIcons.js` | **Extend** — add six imports and exports |
| `frontend/src/data/iconRegistry.js` | **Extend** — add six registry entries |
| `frontend/src/data/iconRegistry.test.js` | **Extend** — add resolveIconName + formatIconName assertions for all six |

### SVG design briefs

**`garlic.svg`** — garlic bulb:
- Round bulb base with a slightly pointed top
- 2–3 vertical curved lines across the bulb suggesting clove segments
- Short stem/root lines at the top

**`hummus.svg`** — bowl of hummus:
- Wide shallow bowl (same arc style as `kornflakesBowl.svg`)
- Smooth rounded mound of filling inside the bowl
- Small oval depression in the centre of the mound (the olive-oil pool)

**`dentalFloss.svg`** — dental floss dispenser:
- Small rectangular box body (the dispenser)
- Rounded corners on the box
- A short curved strand of floss exiting from the top-centre of the box

**`toothpaste.svg`** — toothpaste tube:
- Elongated rounded tube body (horizontal or slightly diagonal)
- Flat, rolled/crimped closed end at one side
- Small cap shape at the other end
- Optional: a short curved ribbon of paste emerging from the cap

**`cottonPads.svg`** — stack of cotton pads:
- Two or three flat ellipses stacked with slight vertical offset to show depth
- Edges slightly irregular/soft (short tick marks or bumped curves) to suggest cotton texture

**`pasta.svg`** — pasta / noodles:
- Three wavy parallel horizontal lines (spaghetti strands) in the centre of the canvas
- A simple fork silhouette to the right with 3 tines, partially behind the strands

### Implementation steps

1. **Create the six SVG files** following the design briefs and conventions above.

2. **Extend `customIcons.js`** — add imports and exports (alphabetical within each block):

   ```js
   import CottonPadsSvg  from "../assets/icons/custom/cottonPads.svg?react";
   import DentalFlossSvg from "../assets/icons/custom/dentalFloss.svg?react";
   import GarlicSvg      from "../assets/icons/custom/garlic.svg?react";
   import HummusSvg      from "../assets/icons/custom/hummus.svg?react";
   import PastaSvg       from "../assets/icons/custom/pasta.svg?react";
   import ToothpasteSvg  from "../assets/icons/custom/toothpaste.svg?react";

   export const CustomCottonPads  = normalizeCustomIcon(CottonPadsSvg,  "CustomCottonPads");
   export const CustomDentalFloss = normalizeCustomIcon(DentalFlossSvg, "CustomDentalFloss");
   export const CustomGarlic      = normalizeCustomIcon(GarlicSvg,      "CustomGarlic");
   export const CustomHummus      = normalizeCustomIcon(HummusSvg,      "CustomHummus");
   export const CustomPasta       = normalizeCustomIcon(PastaSvg,       "CustomPasta");
   export const CustomToothpaste  = normalizeCustomIcon(ToothpasteSvg,  "CustomToothpaste");
   ```

3. **Extend `iconRegistry.js`** — add imports and registry entries (alphabetical):

   ```js
   import {
     CustomCottonPads,
     CustomDentalFloss,
     CustomGarlic,
     CustomHummus,
     CustomKornflakesBox,
     CustomKornflakesBowl,
     CustomPasta,
     CustomToothpaste,
   } from "./customIcons.js";

   // In ICON_REGISTRY (alphabetical):
   CustomCottonPads,
   CustomDentalFloss,
   CustomGarlic,
   CustomHummus,
   CustomPasta,
   CustomToothpaste,
   ```

4. **Extend `iconRegistry.test.js`** — for each new key assert:
   - `resolveIconName("CustomGarlic")` === `"CustomGarlic"` (and same for the other five)
   - `formatIconName("CustomDentalFloss")` === `"Dental Floss"` (strip `Custom`, split camelCase)

5. **Validate:**
   ```bash
   npm run lint
   npm run build
   npm test
   ```

---

## T-006 — Expanded icon set: clothing, fruit, hygiene & misc

### Context

New product categories (clothing, exotic fruits, hygiene accessories, misc) need icon coverage. Seven items may already exist in tabler/lucide; eleven require custom SVG files.

### Files to create / change

| File | Action |
|---|---|
| `frontend/src/assets/icons/custom/cottonSwabs.svg` | **Create** |
| `frontend/src/assets/icons/custom/wetWipes.svg` | **Create** |
| `frontend/src/assets/icons/custom/interdentalSticks.svg` | **Create** |
| `frontend/src/assets/icons/custom/creamTube.svg` | **Create** |
| `frontend/src/assets/icons/custom/creamJar.svg` | **Create** |
| `frontend/src/assets/icons/custom/mango.svg` | **Create** |
| `frontend/src/assets/icons/custom/kiwi.svg` | **Create** |
| `frontend/src/assets/icons/custom/peach.svg` | **Create** |
| `frontend/src/assets/icons/custom/plum.svg` | **Create** |
| `frontend/src/assets/icons/custom/blueberries.svg` | **Create** |
| `frontend/src/assets/icons/custom/eLiquid.svg` | **Create** |
| `frontend/src/data/customIcons.js` | **Extend** — 11 new imports + exports |
| `frontend/src/data/iconRegistry.js` | **Extend** — Group A tabler/lucide + Group B custom icons |
| `frontend/src/data/iconRegistry.test.js` | **Extend** — assertions for all new registry keys |

> ⚠️ No `iconDatabase.js` changes in T-006. All DB entries are written in T-005 (which runs after T-006).

### Implementation steps

#### Step 1 — Group A: tabler/lucide icons

For each candidate, verify the export exists in the installed version of the library. If absent, create a custom SVG fallback instead and document the substitution in the HANDOFF entry.

| Item | Primary candidate | Fallback |
|---|---|---|
| Socken | tabler `IconSock` | custom SVG |
| Hose | tabler `IconPants` | custom SVG |
| Schuhe | tabler `IconShoe` | custom SVG |
| Ananas | tabler `IconPineapple` | custom SVG |
| Wassermelone | lucide `Watermelon` (via `fromLucide()`) | custom SVG |
| Feuerzeug | tabler `IconFlame` | custom SVG |
| Konservendose | tabler `IconCan` | custom SVG |

Add confirmed tabler icons to the tabler import block in `iconRegistry.js` (alphabetical). Wrap confirmed lucide icons with `fromLucide()`.

#### Step 2 — Group B: custom SVG files

All files follow the T-003 conventions:
- `viewBox="0 0 24 24"`, no `width`/`height` on `<svg>` root
- `fill="none"` on root `<svg>`
- `stroke="currentColor"` on all stroked elements
- `stroke-width` omitted (set by normalizer)
- `stroke-linecap="round"` and `stroke-linejoin="round"` on root or each element

**Design briefs:**

`cottonSwabs.svg` — Wattestäbchen:
- Two parallel thin sticks, each with a small oval cotton tip at both ends
- Sticks arranged side by side or slightly crossed

`wetWipes.svg` — Feuchtes Klopapier:
- Rectangular package with rounded corners
- A single wipe/tissue sheet partially pulled out from a slot on top
- One or two gentle wave lines on the exposed sheet to suggest moisture

`interdentalSticks.svg` — Interdental Sticks:
- A slim elongated stick
- Small tapered cylindrical brush head at one end (a few short strokes radiating outward)
- Two stylised tooth outlines with the brush positioned between them

`creamTube.svg` — Creme Tube:
- Elongated tube body (portrait orientation)
- Flat crimped/sealed bottom end
- Small round screw cap at the top
- Optional short curl of cream emerging from the cap

`creamJar.svg` — Creme Tiegel:
- Short wide cylinder (the jar body)
- Flat lid shown slightly lifted or separated above the jar
- Optional thin shine line on the jar side

`mango.svg` — Mango:
- Teardrop / kidney-bean outline for the fruit body
- Short stem at the narrow top end
- One small leaf off the stem

`kiwi.svg` — Kiwi:
- Oval outline for the whole fruit
- Cross-section detail inside: central circle with radiating segments and small seed marks

`peach.svg` — Pfirsich:
- Round fruit outline with a subtle vertical cleft line
- Short stem plus one small leaf at the top

`plum.svg` — Pflaume:
- Oval fruit outline, slightly wider in the middle
- Shallow cleft indent at the top
- Short stem

`blueberries.svg` — Blaubeeren:
- Three small circles clustered together representing berries
- Small five-point star crown mark on top of each berry
- Thin connecting stems

`eLiquid.svg` — E-Liquid / Vape:
- Small bottle with a narrow dropper/nozzle top (resembling a unicorn-bottle shape)
- Two or three small wavy/curling vapor wisps rising from the nozzle tip

#### Step 3 — Extend `customIcons.js`

Add imports and exports for all eleven new custom icons (alphabetical):

```js
import BlueberriesSvg      from "../assets/icons/custom/blueberries.svg?react";
import CottonSwabsSvg      from "../assets/icons/custom/cottonSwabs.svg?react";
import CreamJarSvg         from "../assets/icons/custom/creamJar.svg?react";
import CreamTubeSvg        from "../assets/icons/custom/creamTube.svg?react";
import ELiquidSvg          from "../assets/icons/custom/eLiquid.svg?react";
import InterdentalSticksSvg from "../assets/icons/custom/interdentalSticks.svg?react";
import KiwiSvg             from "../assets/icons/custom/kiwi.svg?react";
import MangoSvg            from "../assets/icons/custom/mango.svg?react";
import PeachSvg            from "../assets/icons/custom/peach.svg?react";
import PlumSvg             from "../assets/icons/custom/plum.svg?react";
import WetWipesSvg         from "../assets/icons/custom/wetWipes.svg?react";

export const CustomBlueberries       = normalizeCustomIcon(BlueberriesSvg,       "CustomBlueberries");
export const CustomCottonSwabs       = normalizeCustomIcon(CottonSwabsSvg,       "CustomCottonSwabs");
export const CustomCreamJar          = normalizeCustomIcon(CreamJarSvg,          "CustomCreamJar");
export const CustomCreamTube         = normalizeCustomIcon(CreamTubeSvg,         "CustomCreamTube");
export const CustomELiquid           = normalizeCustomIcon(ELiquidSvg,           "CustomELiquid");
export const CustomInterdentalSticks = normalizeCustomIcon(InterdentalSticksSvg, "CustomInterdentalSticks");
export const CustomKiwi              = normalizeCustomIcon(KiwiSvg,              "CustomKiwi");
export const CustomMango             = normalizeCustomIcon(MangoSvg,             "CustomMango");
export const CustomPeach             = normalizeCustomIcon(PeachSvg,             "CustomPeach");
export const CustomPlum              = normalizeCustomIcon(PlumSvg,              "CustomPlum");
export const CustomWetWipes          = normalizeCustomIcon(WetWipesSvg,          "CustomWetWipes");
```

#### Step 4 — Update tests

In `iconRegistry.test.js`, add `resolveIconName` + `formatIconName` assertions for every new registry key added in Group A and Group B.

#### Step 5 — Validate

```bash
npm run lint
npm run build
npm test
```

---

## T-005 — Comprehensive iconDatabase.js enrichment

### Context

T-005 is the single authoritative DB task and runs **after T-006**. It covers: all custom icons from T-002–T-004, all icons added in T-006 (Groups A, B, C), redirections of garlic/pasta/grapes, and synonym enrichment across every existing category.

### Prerequisite

T-006 must be `done` before T-005 begins (T-005 references registry keys created in T-006).

### Files to change

| File | Action |
|---|---|
| `frontend/src/data/iconDatabase.js` | **Rewrite** — redirect entries, add new entries, enrich all existing tags |

### Implementation steps

#### Step 1 — Redirect three existing entries

```js
// garlic: IconPepper → CustomGarlic
{ label: "garlic", icon: "CustomGarlic", tags: ["knoblauch", "knoblauchzehe", "knoblauchknolle", "garlic clove", "garlic bulb"] }

// pasta: IconToolsKitchen2 → CustomPasta
{ label: "pasta", icon: "CustomPasta", tags: ["nudeln", "spaghetti", "penne", "fusilli", "rigatoni", "tagliatelle", "linguine", "farfalle", "noodles"] }

// grapes: IconCherry → IconGrape
{ label: "grapes", icon: "IconGrape", tags: ["trauben", "weintrauben", "grape", "raisins", "rosinen", "traube"] }
```

#### Step 2 — Add DB entries for custom icons from T-002–T-004

| Registry key | Label | German tags | English tags |
|---|---|---|---|
| `CustomKornflakesBowl` | cornflakes bowl | kornflakes, müsli, cerealien, frühstücksflocken, getreideflocken | cereal bowl, breakfast cereal |
| `CustomKornflakesBox` | cornflakes box | cornflakes packung, müsli packung, cerealien packung | cereal box, cereal package |
| `CustomGarlic` | garlic | _(covered by redirect above)_ | |
| `CustomHummus` | hummus | hummus, kichererbsenpaste, hummus dip, aufstrich | chickpea dip, hummus paste |
| `CustomDentalFloss` | dental floss | zahnseide, zahnfaden, interdental | floss, dental floss |
| `CustomToothpaste` | toothpaste | zahncreme, zahnpasta, zahnputzmittel, elmex, blend-a-med | toothpaste, tooth cream |
| `CustomCottonPads` | cotton pads | wattepads, abschminkpads, kosmetikpads, reinigungspads | cotton pads, makeup remover pads |
| `CustomPasta` | pasta | _(covered by redirect above)_ | |

#### Step 3 — Add DB entries for T-006 icons (Groups A, B, C)

| Registry key | Label | German tags | English tags |
|---|---|---|---|
| `IconSock` / fallback | sock | socken, strümpfe, kniestrümpfe, söckchen | socks, stockings |
| `IconPants` / fallback | pants | hose, jeans, jogginghose, shorts, leggings, chinos | trousers, pants, jeans, shorts |
| `IconShoe` / fallback | shoe | schuhe, sneaker, turnschuhe, stiefel, sandalen, pumps | shoes, sneakers, boots, sandals |
| `IconPineapple` / fallback | pineapple | ananas, ananasscheibe | pineapple |
| `Watermelon` / fallback | watermelon | wassermelone, melone, wassermelonenscheibe | watermelon |
| `IconFlame` / fallback | lighter | feuerzeug, anzünder, gasfeuerzeug, sturmfeuerzeug | lighter, fire starter |
| `IconCan` / fallback | canned food | konservendose, dose, dosengemüse, dosensuppe, thunfischdose, sardinen, konserve | tin can, canned food, canned goods |
| `CustomCottonSwabs` | cotton swabs | wattestäbchen, q-tips, ohrenstäbchen | cotton swabs, q-tips, ear swabs |
| `CustomWetWipes` | wet wipes | feuchtes klopapier, feuchttücher, nasspapier, feuchtes toilettenpapier | wet wipes, moist toilet paper |
| `CustomInterdentalSticks` | interdental sticks | interdentalbürste, zahnzwischenraumbürste, interdental, zahnreinigung | interdental brush, interdental sticks |
| `CustomCreamTube` | cream tube | creme tube, hautcreme, gesichtscreme, körpercreme, lotion, salbe | cream tube, lotion, face cream |
| `CustomCreamJar` | cream jar | cremetiegel, cremendose, tiegel, gesichtspflege, feuchtigkeitscreme, nachtcreme | cream jar, moisturizer, face cream pot |
| `CustomMango` | mango | mango, mangos, tropenfrucht | mango, mangoes |
| `CustomKiwi` | kiwi | kiwi, kiwis, kiwifrucht | kiwi, kiwifruit |
| `CustomPeach` | peach | pfirsich, pfirsiche, nektarine | peach, nectarine |
| `CustomPlum` | plum | pflaume, pflaumen, zwetschge, zwetschgen | plum, plums |
| `CustomBlueberries` | blueberries | blaubeeren, heidelbeeren, blaubeere | blueberries, blueberry |
| `CustomELiquid` | e-liquid | e-liquid, liquid, vape liquid, dampfliquid, e-zigarette liquid | e-liquid, vape juice, e-cigarette liquid |
| `IconShirt` (existing) | t-shirt clothing | t-shirt, shirt, oberteil, top, unterhemd, poloshirt | t-shirt, shirt, top |
| `IconBattery` (existing) | coin cell | knopfzelle, knopfzellen, uhrbatterie, cr2032 | coin cell, button battery, watch battery |

#### Step 4 — Enrich all existing entries

For **every** existing entry in `ICON_DB`, expand `tags` to at minimum **5 tags total** (label + tags combined). Guiding principles:

- **German regional variants**: Austrian/Swiss German (e.g., Paradeiser, Erdäpfel, Rüebli, Obers)
- **Plural / singular pairs**: ensure both forms are present
- **Brand-name synonyms**: "Tempo" → toilet paper; "Nutella" → spread/jam; "Elmex" → toothpaste
- **Compound word variants**: "Vollmilch", "Halbfettmilch", "Laktosefrei" → milk
- **Related product names** mapping to the same icon: "Latte", "Cappuccino", "Espresso" → coffee
- **Umlaut alternates written out**: ä→ae, ö→oe, ü→ue
- **English synonyms** for common English-typed inputs

Minimum enrichment guidance per category:

_Dairy_: milk → "laktosefrei", "h-milch", "frischmilch", "uht", "obers"; yogurt → "skyr", "kefir", "naturjoghurt", "fruchtjoghurt"; cheese → "frischkäse", "parmesan", "feta", "brie", "schnittkäse"

_Produce_: tomato → "paradeiser", "cocktailtomaten", "rispentomaten", "kirschtomaten"; potato → "erdäpfel", "süßkartoffel", "yams", "kartoffelbrei"; onion → "schalotte", "frühlingszwiebel", "lauch", "porree"; carrot → "rüebli", "baby karotten"; mushroom → "steinpilz", "pfifferlinge", "austernpilze", "shiitake"

_Bakery_: bread → "vollkornbrot", "weißbrot", "toastbrot", "ciabatta", "laugenbrot"; cake → "torte", "geburtstagskuchen", "käsekuchen", "cheesecake"

_Meat & Fish_: chicken → "geflügel", "filet", "schnitzel", "hähnchenfilet"; beef → "hackfleisch", "steak", "rinderhack", "gulasch"; fish → "thunfisch", "seelachs", "forelle", "kabeljau", "tilapia"

_Beverages_: coffee → "latte", "cappuccino", "espresso", "americano", "filterkaffee"; tea → "grüner tee", "schwarztee", "kräutertee", "kamille", "pfefferminze"; beer → "pils", "weizen", "weißbier", "lager", "radler"; juice → "direktsaft", "nektar", "smoothie", "multivitamin"

_Household_: toilet paper → "tempo", "klopapier", "wc-papier", "toilettenpapier"; detergent → "colorwaschmittel", "vollwaschmittel", "waschmittel pods"; cleaner → "badreiniger", "küchenreiniger", "wc-reiniger"

_Condiments_: olive oil → "rapsöl", "sonnenblumenöl", "kokosöl", "bratöl"; ketchup → "tomatensauce", "tomatenmark"; honey → "blütenhonig", "waldhonig", "akazienhonig"

_Pantry_: soup → "brühe", "gemüsebrühe", "hühnerbrühe", "instantsuppe", "dosensuppe"

_Drugstore_: toothpaste → "zahncreme", "elmex", "blend-a-med", "zahnputzmittel"; medicine → "ibuprofen", "aspirin", "paracetamol", "schmerztabletten"

#### Step 5 — Validate

```bash
npm run lint
npm run build
npm test
```

---

## Validation

```
npm run lint
npm run build
npm test
```
