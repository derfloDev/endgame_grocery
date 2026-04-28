# ROADMAP

Goal: Add a free-text details field to grocery entries so users can note quantities, units, brands, or any other context without a rigid format.

## Priority 1

Objective: Persist and display a `details` field on every entry.

- DB migration adds a nullable `details` column to the `entries` table.
- Backend `POST /entries` and `PATCH /entries/:entryId` accept and return `details`.
- `autocomplete_history` is unchanged — `details` is intentionally excluded (details are per-occasion context, not reusable history).
- `AddItemSheet` (add & edit mode) exposes a second optional text input labelled **"Details (optional)"** with placeholder `Beschreibung, Menge...`.
- `EntryRow` renders details as a second, visually subordinate line below the entry name (smaller / dimmed text), shown only when details are non-empty.

## Priority 2

Objective: Always show an icon on Recently Used chips and Autocomplete suggestion chips.

- `RecentlyUsedSection`: when `item.icon` is null, unknown, or absent, render the fallback `IconShoppingCart` instead of omitting the icon entirely.
- `AutocompleteSuggestions`: when `suggestion.icon` is null, unknown, or absent, render the fallback `IconShoppingCart` instead of omitting the icon entirely.

## Priority 5

Objective: Fix PWA install failure when the app is hosted behind Cloudflare Access.

- Add `useCredentials: true` to the `VitePWA` config so the injected `<link rel="manifest">` carries `crossorigin="use-credentials"`, allowing the browser to send the `CF_Authorization` cookie when fetching the manifest.
- Add a code comment in `vite.config.js` explaining why the option is set.
- Document in `README.md` (Docker Deployment section) that deployments behind Cloudflare Access must additionally add a CF Access bypass policy for `/sw.js` and `/workbox-*.js`, since those scripts are fetched without credentials by the browser's SW registration API.

## Priority 4

Objective: Make icon resolution resilient to icon renames so stored entry data never breaks.

- Export `ICON_ALIASES` (frozen map, initially empty) and `resolveIconName(name)` from `iconRegistry.js`.
- `resolveIconName(name)` returns: the name itself if known, the canonical alias target if aliased, or `null` for null/unknown input.
- Export `FALLBACK_ICON_NAME` from `iconRegistry.js` so components do not hardcode it.
- Export `formatIconName(name)` from `iconRegistry.js`: strips the `"Icon"` prefix, splits PascalCase into words, and separates trailing digits — so `"IconIceCream2"` → `"Ice Cream 2"` and `"CakeSlice"` → `"Cake Slice"`.
- Refactor `EntryRow`, `RecentlyUsedSection`, `AutocompleteSuggestions`, and `AddItemSheet` to use the shared `resolveIconName` instead of their own local lookup logic.
- Use `formatIconName` in `AddItemSheet` for all icon labels in the browser and suggested-icon picker so no `"Icon"` prefix is visible to the user.
- When a future icon rename occurs, only `ICON_ALIASES` in `iconRegistry.js` needs one new entry — no component changes required.

## Priority 3

Objective: Expand the icon registry with food, household, and health icons from Tabler and Lucide.

- Add 17 new Tabler icons: `IconBlender`, `IconBone`, `IconBowl`, `IconBowlChopsticks`, `IconBowlSpoon`, `IconChefHat`, `IconEggCracked`, `IconLollipop`, `IconMelon`, `IconMicrowave`, `IconNut`, `IconPlant`, `IconPlant2`, `IconSeeding` (seed), `IconSunglasses`, `IconTeapot` (tea), `IconWheat`.
- Add 28 new Lucide icons (via `fromLucide()`): `CakeSlice`, `CandyCane`, `Citrus`, `CookingPot`, `Croissant`, `CupSoda`, `Dessert`, `Donut`, `Drumstick`, `FishSymbol`, `ForkKnife`, `GlassWater`, `Ham`, `Hamburger`, `Hop`, `IceCreamBowl`, `IceCreamCone`, `Martini`, `Popcorn`, `Refrigerator`, `Sandwich`, `Shrimp`, `UtensilsCrossed`, `Vegan`, `Wine`, `Cigarette`, `Syringe`, `PillBottle`.
- Update `iconDatabase.js` existing entries to use the new, more specific icons where relevant.
- Add `iconDatabase.js` keyword entries for newly added icons so the suggestion engine recognises them.
- Icons unavailable in either library are omitted: bacon, broccoli, confectionery, corn, fork, fries, garlic, hot-dog, juice, knife, mussels, mustard, noodles, olive, onion, pancake, peach, peanut, pickle, pie, plate, potato, pretzel, pumpkin, radish, rib-eye-steak, rice, spoon, steak, strawberry, sugar-paste, sweet-potato, taco, toast, tomato, turkey, vegetable, watermelon.
