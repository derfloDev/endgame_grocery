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

## Priority 3

Objective: Expand the icon registry with food, household, and health icons from Tabler and Lucide.

- Add 17 new Tabler icons: `IconBlender`, `IconBone`, `IconBowl`, `IconBowlChopsticks`, `IconBowlSpoon`, `IconChefHat`, `IconEggCracked`, `IconLollipop`, `IconMelon`, `IconMicrowave`, `IconNut`, `IconPlant`, `IconPlant2`, `IconSeeding` (seed), `IconSunglasses`, `IconTeapot` (tea), `IconWheat`.
- Add 28 new Lucide icons (via `fromLucide()`): `CakeSlice`, `CandyCane`, `Citrus`, `CookingPot`, `Croissant`, `CupSoda`, `Dessert`, `Donut`, `Drumstick`, `FishSymbol`, `ForkKnife`, `GlassWater`, `Ham`, `Hamburger`, `Hop`, `IceCreamBowl`, `IceCreamCone`, `Martini`, `Popcorn`, `Refrigerator`, `Sandwich`, `Shrimp`, `UtensilsCrossed`, `Vegan`, `Wine`, `Cigarette`, `Syringe`, `PillBottle`.
- Update `iconDatabase.js` existing entries to use the new, more specific icons where relevant.
- Add `iconDatabase.js` keyword entries for newly added icons so the suggestion engine recognises them.
- Icons unavailable in either library are omitted: bacon, broccoli, confectionery, corn, fork, fries, garlic, hot-dog, juice, knife, mussels, mustard, noodles, olive, onion, pancake, peach, peanut, pickle, pie, plate, potato, pretzel, pumpkin, radish, rib-eye-steak, rice, spoon, steak, strawberry, sugar-paste, sweet-potato, taco, toast, tomato, turkey, vegetable, watermelon.
