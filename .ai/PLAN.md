# Plan

Status: **ready** (T-001/T-002 done; T-003 newly planned)

Goal: Add a free-text `details` field to grocery entries (ROADMAP.md — Priority 1).

## Scope

- DB: nullable `details` column on `entries`.
- Backend: `GET`, `POST`, `PATCH` entry routes expose `details`; `autocomplete_history` is not changed.
- Frontend API client: `createEntry` forwards `details`; `updateEntry` already forwards a generic payload.
- `AddItemSheet`: new optional "Details (optional)" input; `onAdd` callback gains a third `details` argument.
- `EntryRow`: renders a dimmed second line for `details` when non-empty.
- `ListDetailPage`: wires `details` through add, edit, and optimistic-update paths.

## Acceptance Criteria

1. A `details` column (nullable TEXT) exists on `entries` after migration.
2. `POST /api/lists/:id/entries` stores `details` and returns it in the response body.
3. `GET /api/lists/:id/entries` returns `details` for every entry.
4. `PATCH /api/lists/:id/entries/:entryId`:
   - When `details` key is **absent** from the body → existing value is preserved.
   - When `details` key is **present** (including `""` or `null`) → value is trimmed and stored as `null` if blank, otherwise stored as-is.
5. `AddItemSheet` (add mode) renders a second input with `label="Details (optional)"` and `placeholder="Beschreibung, Menge..."`.
6. `AddItemSheet` (edit mode) pre-fills the details input from `initialDetails` prop.
7. Submitting the sheet calls `onAdd(text, icon, details)` with `details` as the third argument (empty string when blank).
8. `EntryRow` renders `entry.details` in a visually subordinate line (CSS class `entry-row-details`) when the value is non-empty; line is absent when details is null/empty.
9. All existing tests continue to pass; new tests cover the `details` field at every layer.

## Implementation Phases

### Phase 1 — T-001: DB migration + backend

**Files to change:**
- `backend/src/db/migrations/<next_timestamp>_add_details_to_entries.cjs` *(new)*
  - `up`: `pgm.addColumns("entries", { details: { type: "text", notNull: false } })`
  - `down`: `pgm.dropColumns("entries", ["details"])`
- `backend/src/routes/entries.js`
  - `GET`: add `details` to `SELECT` column list.
  - `POST`: destructure `details` from body; pass `details?.trim() || null` as new query param; add to INSERT columns and RETURNING list.
  - `PATCH`: destructure `details` from body; detect presence via `'details' in (req.body ?? {})`; when present, include `details = $n` (direct assignment, not COALESCE) in the SET clause; add `details` to RETURNING list. Use a boolean flag param to conditionally update the column (e.g. `details = CASE WHEN $n THEN $n+1 ELSE details END`).
  - Validation: the `details` field is always optional; its presence alone does not satisfy the "at least one field" guard — that guard already covers `text`, `status`, `icon`.
- `backend/src/entries.test.js`
  - Update the SQL assertion regex in "returns entries" test to include `details`.
  - Update the INSERT assertion to include `details` and its param.
  - Update all `params` deep-equal assertions that reference the fixed param array to include `details`.
  - Add test: `POST` with `details` stores and returns it.
  - Add test: `PATCH` with `details` present updates the column.
  - Add test: `PATCH` without `details` key preserves the existing column value.
  - Add test: `PATCH` with `details: ""` clears the column to null.

### Phase 2 — T-002: Frontend

**Files to change:**
- `frontend/src/api/entries.js`
  - `createEntry({ text, icon, details })`: include `details` in the POST payload.
- `frontend/src/components/AddItemSheet.jsx`
  - Add prop `initialDetails = ""`.
  - Add state `const [details, setDetails] = useState(initialDetails)`.
  - Reset `details` in the `open` / `initialDetails` `useEffect`.
  - Add a second `<div className="eg-field">` block after the existing text field:
    ```jsx
    <label htmlFor={detailsInputId}>Details (optional)</label>
    <input
      id={detailsInputId}
      className="eg-input"
      placeholder="Beschreibung, Menge..."
      value={details}
      onChange={(e) => setDetails(e.target.value)}
    />
    ```
  - `handleSubmit`: call `onAdd(trimmed, selectedIconName, details)`.
  - `handleQuickAdd`: call `onAdd(trimmed, suggestedIconName, "")` (quick-add has no details).
- `frontend/src/components/AddItemSheet.test.jsx`
  - Update all `expect(onAdd).toHaveBeenCalledWith(text, icon)` assertions to `(text, icon, "")` (empty details) or the appropriate details value.
  - Add test: renders "Details (optional)" label and correct placeholder.
  - Add test: submitting with details text calls `onAdd` with that details string.
  - Add test (edit mode): pre-fills details input from `initialDetails` prop.
- `frontend/src/components/EntryRow.jsx`
  - Inside `.entry-row-copy`, after the `<p>` for `entry.text`, add:
    ```jsx
    {entry.details ? <p className="entry-row-details">{entry.details}</p> : null}
    ```
- `frontend/src/components/entry-row.test.jsx`
  - Add test: renders `.entry-row-details` when `entry.details` is non-empty.
  - Add test: does not render `.entry-row-details` when `entry.details` is null/undefined.
- `frontend/src/pages/ListDetailPage.jsx`
  - `addEntryByText(text, icon, details)`: pass `details` to `createEntry` and to the optimistic `temporaryEntry`.
  - `submitEditEntry(entryId, text, iconName, details)`: pass `details` in the `updateEntry` payload and in the optimistic update.
  - Edit-mode `AddItemSheet`: add `initialDetails={editingEntry?.details ?? ""}` prop; update `onAdd` callback signature to `(text, icon, details)` and forward to `submitEditEntry`.
  - Add-mode `AddItemSheet`: update `onAdd` callback signature to `(text, icon, details)` and forward to `addEntryByText`.
- `frontend/src/index.css`
  - Add `.entry-row-details` rule: smaller font size (e.g. `0.8rem`), muted color (`var(--text-secondary)` or similar), `margin: 0`, no extra top margin (tight to the name line).

### Phase 3 — T-003: Fallback icon in chips

**Context:**  
`RecentlyUsedSection` and `AutocompleteSuggestions` both omit the icon element entirely when `item.icon` / `suggestion.icon` is null or unknown. Both should always render the fallback `IconShoppingCart` instead.

**Files to change:**
- `frontend/src/components/RecentlyUsedSection.jsx`
  - Change `resolveIconName`: replace `return null` with `return FALLBACK_ICON_NAME` when `iconName` is falsy.
  - Result: `ItemIcon` is never null → the conditional `{ItemIcon ? ... : null}` always renders the icon. The conditional can be simplified to an unconditional render.
- `frontend/src/components/AutocompleteSuggestions.jsx`
  - Import `FALLBACK_ICON` from `../data/iconRegistry`.
  - Change icon resolution to: `const SuggestionIcon = (suggestion.icon ? ICON_REGISTRY[suggestion.icon] : null) ?? FALLBACK_ICON;`
  - Replace `{SuggestionIcon ? <SuggestionIcon ... /> : null}` with an unconditional `<SuggestionIcon ... />`.
- `frontend/src/components/AutocompleteSuggestions.test.jsx`
  - Update the existing test **"renders a suggestion without an icon and keeps the dropdown row full-width with a 44px touch target"**:
    - Remove the assertion `expect(container.querySelector(".autocomplete-chip svg")).toBeNull()`.
    - Add assertion that the fallback icon SVG **is** rendered, e.g. `expect(container.querySelector(".autocomplete-chip svg")).toBeTruthy()`.
    - Retain the CSS assertions for `min-height: 44px` and `width: 100%`.
- `frontend/src/components/RecentlyUsedSection.test.jsx`
  - Add test: when an item has `icon: null`, the chip still renders an SVG icon (fallback).
  - Verify via `container.querySelector(".recently-used-chip-icon")` being truthy.

### Phase 4 — T-004: Icon registry expansion

**Context:**  
`iconRegistry.js` currently holds ~80 icons. 45 new icons are to be added from Tabler (primary) and Lucide (secondary, wrapped via `fromLucide()`). `iconDatabase.js` maps text keywords to icon names for the suggestion engine and must be updated in sync.

**Files to change:**

#### `frontend/src/data/iconRegistry.js`

1. **New Tabler imports** — add to the existing `@tabler/icons-react` import block (alphabetical order):
   ```
   IconBlender, IconBone, IconBowl, IconBowlChopsticks, IconBowlSpoon,
   IconChefHat, IconEggCracked, IconLollipop, IconMelon, IconMicrowave,
   IconNut, IconPlant, IconPlant2, IconSeeding, IconSunglasses,
   IconTeapot, IconWheat
   ```

2. **New Lucide imports** — add to the existing `lucide-react` import block (alphabetical order):
   ```
   CakeSlice, CandyCane, Citrus, CookingPot, Croissant, CupSoda,
   Dessert, Donut, Drumstick, FishSymbol, ForkKnife, GlassWater,
   Ham, Hamburger, Hop, IceCreamBowl, IceCreamCone, Martini,
   Popcorn, Refrigerator, Sandwich, Shrimp, UtensilsCrossed,
   Vegan, Wine, Cigarette, Syringe, PillBottle
   ```

3. **ICON_REGISTRY** — add all new icons in alphabetical order, Tabler ones as direct references, Lucide ones wrapped with `fromLucide()`:
   ```js
   CakeSlice: fromLucide(CakeSlice),
   CandyCane: fromLucide(CandyCane),
   Cigarette: fromLucide(Cigarette),
   Citrus: fromLucide(Citrus),
   CookingPot: fromLucide(CookingPot),
   Croissant: fromLucide(Croissant),
   CupSoda: fromLucide(CupSoda),
   Dessert: fromLucide(Dessert),
   Donut: fromLucide(Donut),
   Drumstick: fromLucide(Drumstick),
   FishSymbol: fromLucide(FishSymbol),
   ForkKnife: fromLucide(ForkKnife),
   GlassWater: fromLucide(GlassWater),
   Ham: fromLucide(Ham),
   Hamburger: fromLucide(Hamburger),
   Hop: fromLucide(Hop),
   IceCreamBowl: fromLucide(IceCreamBowl),
   IceCreamCone: fromLucide(IceCreamCone),
   IconBlender,
   IconBone,
   IconBowl,
   IconBowlChopsticks,
   IconBowlSpoon,
   IconChefHat,
   IconEggCracked,
   IconLollipop,
   IconMelon,
   IconMicrowave,
   IconNut,
   IconPlant,
   IconPlant2,
   IconSeeding,
   IconSunglasses,
   IconTeapot,
   IconWheat,
   Martini: fromLucide(Martini),
   PillBottle: fromLucide(PillBottle),
   Popcorn: fromLucide(Popcorn),
   Refrigerator: fromLucide(Refrigerator),
   Sandwich: fromLucide(Sandwich),
   Shrimp: fromLucide(Shrimp),
   Syringe: fromLucide(Syringe),
   UtensilsCrossed: fromLucide(UtensilsCrossed),
   Vegan: fromLucide(Vegan),
   Wine: fromLucide(Wine),
   ```
   Insert each entry in its correct alphabetical position within the existing registry object.

#### `frontend/src/data/iconDatabase.js`

**Update existing entries** to use the better, more specific new icons:

| Entry label | Old icon | New icon |
|---|---|---|
| croissant | `IconCakeRoll` | `Croissant` |
| ham | `IconSausage` | `Ham` |
| shrimp | `IconFishBone` | `Shrimp` |
| ice cream | `IconIceCream2` | `IceCreamBowl` |
| ice cream cone | `IconIceCream` | `IceCreamCone` |
| nuts | `IconLeaf2` | `IconNut` |
| popcorn | `IconCandy` | `Popcorn` |
| tea | `IconCup` | `IconTeapot` |
| wine | `IconGlassChampagne` | `Wine` |

**Add new keyword entries** for icons that have no existing entry (insert under the most appropriate category comment):

```js
// Produce / new
{ label: "melon", icon: "IconMelon", tags: ["melone", "cantaloup", "honeydew"] },
{ label: "wheat", icon: "IconWheat", tags: ["weizen"] },
{ label: "plant", icon: "IconPlant", tags: ["pflanze", "blume"] },

// Bakery / new
{ label: "croissant", icon: "Croissant", tags: ["croissants", "gipfel"] },  // replaces existing CakeRoll entry
{ label: "donut", icon: "Donut", tags: ["doughnut", "berliner"] },

// Meat and fish / new
{ label: "shrimp", icon: "Shrimp", tags: ["garnele", "garnelen", "prawn", "prawns"] },  // replaces existing FishBone entry
{ label: "drumstick", icon: "Drumstick", tags: ["hähnchenkeule", "haehnchenkeule", "chicken leg"] },
{ label: "ham", icon: "Ham", tags: ["schinken"] },  // replaces existing Sausage entry

// Beverages / new
{ label: "wine", icon: "Wine", tags: ["wein", "rotwein", "weißwein", "weisswein"] },  // replaces existing entry
{ label: "martini", icon: "Martini", tags: ["cocktail"] },
{ label: "soda", icon: "CupSoda", tags: ["cola", "softdrink", "limonade", "limo"] },
{ label: "glass of water", icon: "GlassWater", tags: ["glas wasser"] },

// Snacks / new
{ label: "sandwich", icon: "Sandwich", tags: ["sandwich", "belegtes brot"] },
{ label: "hamburger", icon: "Hamburger", tags: ["burger", "cheeseburger"] },
{ label: "popcorn", icon: "Popcorn", tags: ["popcorn", "kinoschnack"] },  // replaces existing Candy entry
{ label: "ice cream", icon: "IceCreamBowl", tags: ["eis", "speiseeis"] },  // replaces existing entry
{ label: "ice cream cone", icon: "IceCreamCone", tags: ["softeis", "soft serve"] },  // replaces existing entry

// Kitchen appliances / new
{ label: "refrigerator", icon: "Refrigerator", tags: ["kühlschrank", "kuehlschrank", "fridge"] },
{ label: "microwave", icon: "IconMicrowave", tags: ["mikrowelle"] },
{ label: "blender", icon: "IconBlender", tags: ["mixer", "standmixer"] },
{ label: "cooking pot", icon: "CookingPot", tags: ["kochtopf", "pot"] },

// Fruit & veg specialties / new
{ label: "citrus", icon: "Citrus", tags: ["zitrusfrucht", "orange", "grapefruit"] },
{ label: "cake slice", icon: "CakeSlice", tags: ["tortenstück", "kuchenstück"] },
{ label: "candy cane", icon: "CandyCane", tags: ["zuckerstange"] },
{ label: "lollipop", icon: "IconLollipop", tags: ["lutscher"] },
{ label: "dessert", icon: "Dessert", tags: ["nachtisch", "nachspeise"] },

// Misc food / new
{ label: "bowl", icon: "IconBowl", tags: ["schüssel", "schale", "müslischale"] },
{ label: "fork and knife", icon: "ForkKnife", tags: ["besteck", "cutlery"] },
{ label: "utensils", icon: "UtensilsCrossed", tags: ["küchenutensilien"] },
{ label: "vegan", icon: "Vegan", tags: ["vegetarisch", "plant-based"] },
{ label: "hop", icon: "Hop", tags: ["hopfen", "craft beer"] },
{ label: "fish symbol", icon: "FishSymbol", tags: ["fisch symbol"] },
{ label: "chef hat", icon: "IconChefHat", tags: ["kochmütze", "kochmuetze"] },
{ label: "bone", icon: "IconBone", tags: ["knochen", "dog treat"] },

// Health / new
{ label: "syringe", icon: "Syringe", tags: ["spritze", "impfung", "injection"] },
{ label: "pill bottle", icon: "PillBottle", tags: ["pillendose", "medikamentenflasche"] },
{ label: "cigarette", icon: "Cigarette", tags: ["zigarette", "zigaretten", "tabak"] },
{ label: "sunglasses", icon: "IconSunglasses", tags: ["sonnenbrille"] },

// Seeds & plants / new  
{ label: "seed", icon: "IconSeeding", tags: ["samen", "saat"] },
{ label: "nuts", icon: "IconNut", tags: ["nüsse", "nuesse", "mixed nuts"] },  // replaces existing Leaf2 entry
{ label: "tea", icon: "IconTeapot", tags: ["tee", "teekanne"] },  // replaces existing Cup entry
```

Note: Where an entry is "replacing" an existing one, update the `icon` field of the existing row rather than adding a duplicate. The label + tags remain the same.

**No new test files are required** — `iconRegistry.js` and `iconDatabase.js` are static data modules tested implicitly by the icon browser and suggestion hook tests. Verify that all newly imported names resolve without build error (`npm run build`) and that existing tests still pass (`npm test`).

## Validation

```
npm run lint
npm run build
npm test
```
