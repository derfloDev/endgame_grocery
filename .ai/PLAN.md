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

### Phase 5 — T-005: Resilient icon resolution

**Context:**  
Icon names are stored as strings in the DB. If a name changes (library upgrade, registry refactor), entries show the fallback cart icon instead of the intended one. The fix is a single shared resolution layer with an alias map, so one `ICON_ALIASES` entry handles any future rename without touching components.

`resolveIconName(name)` contract:
- `null` / `undefined` → `null` (preserves "no icon set" semantics)
- known name in `ICON_REGISTRY` → return as-is
- name in `ICON_ALIASES` whose target is in `ICON_REGISTRY` → return canonical name
- anything else (unknown, no alias) → `null`

Callers that must always render an icon (chips) use `resolveIconName(x) ?? FALLBACK_ICON_NAME`.  
Callers that allow no-icon (EntryRow) use `ICON_REGISTRY[resolveIconName(x)] ?? FALLBACK_ICON`.

**Files to change:**

#### `frontend/src/data/iconRegistry.js`
- Export `FALLBACK_ICON_NAME = "IconShoppingCart"` (removes hardcoded duplicates in components).
- Export `ICON_ALIASES = Object.freeze({})` — starts empty; developers add one entry per rename, e.g.:
  ```js
  // When IconEgg is renamed to EggFresh:
  // IconEgg: "EggFresh"
  ```
- Export `resolveIconName(name)`:
  ```js
  export function resolveIconName(name) {
    if (name == null) return null;
    if (ICON_REGISTRY[name]) return name;
    const alias = ICON_ALIASES[name];
    return alias && ICON_REGISTRY[alias] ? alias : null;
  }
  ```
  Place this function after the `ICON_REGISTRY` and `ICON_ALIASES` declarations.
- Export `formatIconName(name)` — produces a human-readable label for display in the icon picker:
  ```js
  export function formatIconName(name) {
    // Strip leading "Icon" prefix (Tabler icons)
    const stripped = name.startsWith("Icon") ? name.slice(4) : name;
    return stripped
      // Split on lowercase→uppercase boundary: "IceCream" → "Ice Cream"
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // Split on sequence of caps followed by cap+lowercase: "HTMLParser" → "HTML Parser"
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      // Split on letter→digit boundary: "IceCream2" → "Ice Cream 2"
      .replace(/([a-zA-Z])(\d)/g, "$1 $2")
      // Split on digit→letter boundary: "2D" → "2 D" (edge case)
      .replace(/(\d)([a-zA-Z])/g, "$1 $2")
      .trim();
  }
  ```
  Examples: `"IconMilk"` → `"Milk"`, `"IconIceCream2"` → `"Ice Cream 2"`, `"CakeSlice"` → `"Cake Slice"`, `"ForkKnife"` → `"Fork Knife"`, `"Banana"` → `"Banana"`.

#### `frontend/src/components/EntryRow.jsx`
- Add `FALLBACK_ICON_NAME, resolveIconName` to the `iconRegistry` import; remove `FALLBACK_ICON` import if it becomes unused.
- Delete the local `normalizeSelectedIconName` function and its `FALLBACK_ICON_NAME` constant.
- Replace usage:
  ```js
  const resolvedIconName = resolveIconName(entry.icon);
  const EntryIcon = ICON_REGISTRY[resolvedIconName] ?? FALLBACK_ICON;
  // data-icon-name={resolvedIconName ?? FALLBACK_ICON_NAME}  ← unchanged
  ```

#### `frontend/src/components/RecentlyUsedSection.jsx`
- Add `FALLBACK_ICON_NAME, resolveIconName` to the `iconRegistry` import; remove `FALLBACK_ICON` import.
- Delete the local `resolveIconName` function and its `FALLBACK_ICON_NAME` constant.
- Replace usage:
  ```js
  const resolvedIconName = resolveIconName(item.icon) ?? FALLBACK_ICON_NAME;
  const ItemIcon = ICON_REGISTRY[resolvedIconName];
  ```

#### `frontend/src/components/AutocompleteSuggestions.jsx`
- Add `FALLBACK_ICON_NAME, resolveIconName` to the `iconRegistry` import; remove `FALLBACK_ICON` import.
- Replace inline resolution:
  ```js
  const resolvedIconName = resolveIconName(suggestion.icon) ?? FALLBACK_ICON_NAME;
  const SuggestionIcon = ICON_REGISTRY[resolvedIconName];
  ```

#### `frontend/src/components/AddItemSheet.jsx`
- Import `resolveIconName` and `formatIconName` from `iconRegistry`.
- In `useState` initialiser: `useState(resolveIconName(initialIconName))` — normalises aliased names from DB on first render.
- In the `useEffect` for `[initialIconName, initialText, open]`: `setSelectedIconName(resolveIconName(initialIconName))` — same normalisation on re-open.
- Icon browser labels: replace `{browserIconName}` (the raw key) with `{formatIconName(browserIconName)}` in both the `aria-label` and the visible `<span>`. Example: `aria-label={`Browse ${formatIconName(browserIconName)}`}`.
- Suggested-icon picker labels: replace `{suggestedIconName}` in `aria-label={`Choose ${suggestedIconName}`}` with `formatIconName(suggestedIconName)`.
- No other changes; the picker only ever writes valid current registry names as the stored value.

#### `frontend/src/data/iconRegistry.test.js` *(new file)*
- Test `resolveIconName`:
  - `null` → `null`
  - `undefined` → `null`
  - known name (e.g. `"IconMilk"`) → `"IconMilk"`
  - unknown name with no alias → `null`
- The alias branch (`ICON_ALIASES` lookup) cannot be tested against the frozen production map. Document in a comment that adding a real alias must be accompanied by a test entry using `vi.mock` or a local alias fixture.
- Test `formatIconName`:
  - `"IconMilk"` → `"Milk"`
  - `"IconIceCream2"` → `"Ice Cream 2"`
  - `"CakeSlice"` → `"Cake Slice"`
  - `"ForkKnife"` → `"Fork Knife"`
  - `"Banana"` → `"Banana"`
  - `"IconBowlChopsticks"` → `"Bowl Chopsticks"`

#### Existing tests
- `entry-row.test.jsx`: no changes expected — `data-icon-name` assertions still pass because `resolveIconName("IconMilk")` → `"IconMilk"` and `resolveIconName(null) ?? FALLBACK_ICON_NAME` → `"IconShoppingCart"`.
- `RecentlyUsedSection.test.jsx`, `AutocompleteSuggestions.test.jsx`: no changes expected — behaviour is identical, only the source of the logic moved.
- `AddItemSheet.test.jsx`: **aria-label assertions must be updated** — e.g. `"Choose IconLeaf"` → `"Choose Leaf"`, `"Browse IconTrash"` → `"Browse Trash"`, `"Browse Banana"` → `"Browse Banana"` (unchanged), `"Browse IconMilk"` → `"Browse Milk"`. Update all `getByRole("button", { name: "Browse ..." })` and `"Choose ..."` lookups to use the formatted name.

### Phase 6 — T-006: PWA manifest credentials for Cloudflare Access

**Context:**  
When the app is hosted behind Cloudflare Access, the browser fetches `manifest.webmanifest` in `no-cors` mode without sending the `CF_Authorization` cookie. CF Access redirects the request to its login page; the browser receives HTML instead of JSON and silently fails to register the PWA. Setting `useCredentials: true` in VitePWA causes the injected manifest link to include `crossorigin="use-credentials"`, which makes the browser send credentials with the manifest fetch.

The service worker scripts (`/sw.js`, `/workbox-*.js`) are fetched by `navigator.serviceWorker.register()` without credentials and cannot be fixed from the client side alone — a CF Access bypass policy is required for those paths. This is documented but not automated.

**Files to change:**

#### `frontend/vite.config.js`
- Add `useCredentials: true` inside the `VitePWA({...})` options object (top-level option, alongside `registerType`).
- Add an inline comment above it:
  ```js
  // Required when the app is served behind Cloudflare Access: sends the CF_Authorization
  // cookie with the manifest fetch so Access does not redirect it to the login page.
  // Note: /sw.js and /workbox-*.js must be bypassed in CF Access separately (see README).
  useCredentials: true,
  ```

#### `README.md`
- Under the **Docker Deployment** section, add a new subsection **"Cloudflare Access"** after the Environment variables table:

  ```markdown
  ### Cloudflare Access

  If you host the app behind Cloudflare Access, two bypass policies are required so the
  PWA can install correctly:

  | Path pattern | Reason |
  | --- | --- |
  | `/sw.js` | Service worker script — fetched without credentials by the browser's SW registration API |
  | `/workbox-*.js` | Workbox runtime chunks loaded by the service worker |

  The manifest (`/manifest.webmanifest`) does not need a bypass policy: the app already
  sets `crossorigin="use-credentials"` on the manifest link so the browser sends the
  `CF_Authorization` cookie with that request.
  ```

**No tests required** — `vite.config.js` changes are build-time configuration and verified by `npm run build` producing an `index.html` whose injected manifest link contains `crossorigin="use-credentials"`.

## Validation

```
npm run lint
npm run build
npm test
```
