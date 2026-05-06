# ROADMAP

Goal: Add full i18n support (German + English) to Endgame Grocery with offline-first locale delivery via the Service Worker.

## Priority 1 — i18n Infrastructure

Objective: Wire up i18next with ICU message format, language detection, and offline-capable locale delivery.

- `i18next`, `react-i18next`, `i18next-browser-languagedetector`, `i18next-icu`, and `i18next-resources-to-backend` installed in `frontend/`.
- Single `translation` namespace; locale files at `frontend/src/locales/{en,de}/translation.json`.
- Lazy loading via Vite code-splitting (`i18next-resources-to-backend` + dynamic `import()`).
- Language detection priority: `localStorage` → `navigator.language` → fallback `en`.
- Workbox `globPatterns` extended with `**/*.json` so locale chunks are precached by the Service Worker.
- `document.documentElement.lang` updated reactively on every language change.
- i18n initialised in `main.jsx` before the React tree renders.

## Priority 2 — String Extraction

Objective: Replace every hardcoded UI string in components and pages with `t()` calls.

- All ~130 user-visible strings extracted into `en/translation.json` and translated into `de/translation.json`.
- ICU plural syntax (`{count, plural, one {…} other {…}}`) used for count-dependent messages (offline queue banner, squad count, etc.).
- German placeholders already present in `AddItemSheet.jsx` ("Beschreibung, Menge…", "Weniger anzeigen", "Mehr anzeigen") corrected and moved to locale files.
- Aria-labels, placeholders, and confirmation dialogs all translated.

## Priority 3 — Language Switcher UI

Objective: Allow users to switch language inside the "Info & Settings" sheet.

- `LanguageSwitcher` component: two-state `DE` / `EN` button-group toggle styled to existing design tokens.
- Mounted inside `InfoSheet` below the user identity section.
- Selection persisted to `localStorage` via i18next-browser-languagedetector; UI re-renders immediately on change.
- Unit test for `LanguageSwitcher` covering toggle behaviour and persistence.

## Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | Type safety | Plain JS — no TypeScript migration |
| 2 | Namespace granularity | Single namespace (`translation`) |
| 3 | SW caching | `**/*.json` added to Workbox `globPatterns` |
| 4 | Language switcher UI | Custom `DE` / `EN` button-group toggle |
