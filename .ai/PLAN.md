# Plan

Status: **ready_for_implement**

Goal: Add full i18n support (German + English) to Endgame Grocery — infrastructure, string extraction, and a language-switcher UI — with offline-first locale delivery via the existing Service Worker.

---

## Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | Type safety | Plain JS — no TypeScript, no key augmentation |
| 2 | Namespace | Single namespace `translation` per language |
| 3 | Lazy loading | `i18next-resources-to-backend` + Vite dynamic `import()` (files in `src/locales/`) |
| 4 | SW caching | Add `**/*.json` to Workbox `globPatterns` in `vite.config.js` |
| 5 | Language switcher | Custom `DE` / `EN` button-group toggle in `InfoSheet` |

---

## Scope

### T-001 — i18n Infrastructure

Install packages, configure i18next, create locale files, wire SW caching, initialise in `main.jsx`.

### T-002 — String Extraction

Replace every hardcoded UI string in all components and pages with `t()` calls; populate both locale files.

### T-003 — Language Switcher UI

Create the `LanguageSwitcher` component, integrate it into `InfoSheet`, and write a unit test.

---

## Acceptance Criteria

- App renders in English on first load (no prior preference stored).
- `navigator.language === 'de'` (or stored localStorage preference `'de'`) causes the app to render in German on load.
- Switching language in the Info & Settings sheet immediately re-renders all strings; preference persists across reloads.
- `document.documentElement.lang` matches the active language at all times.
- `npm run build` succeeds; `dist/` contains separate JSON-derived chunks for `en` and `de` translations (or equivalent Vite output).
- `npm run lint` passes with zero errors.
- `npm test` passes (LanguageSwitcher unit test green).
- Offline: after one online load, reloading with network disabled still shows the correct translated UI.

---

## Implementation Phases

### Phase 1 — T-001: i18n Infrastructure

#### 1.1 Install dependencies

In `frontend/`, install the following packages as production dependencies:

```
i18next
react-i18next
i18next-browser-languagedetector
i18next-icu
i18next-resources-to-backend
```

#### 1.2 Create locale files

Create directory structure:

```
frontend/src/locales/
  en/translation.json
  de/translation.json
```

Use the flat-with-namespace key structure shown in §Key Catalogue below.
Both files must contain identical key sets; values differ by language.

#### 1.3 Create `frontend/src/i18n.js`

```js
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import ICU from 'i18next-icu';

i18next
  .use(ICU)
  .use(LanguageDetector)
  .use(resourcesToBackend((language, namespace) =>
    import(`./locales/${language}/${namespace}.json`)
  ))
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'de'],
    defaultNS: 'translation',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    interpolation: {
      escapeValue: false,  // React already escapes
    },
  });

// Keep <html lang> in sync with the active language
function applyLangAttribute(lng) {
  document.documentElement.lang = lng.split('-')[0]; // 'de-AT' → 'de'
}
applyLangAttribute(i18next.language);
i18next.on('languageChanged', applyLangAttribute);

export default i18next;
```

#### 1.4 Update `frontend/src/main.jsx`

Add `import './i18n';` as the **first** import (before React and App), so i18next initialises before any component renders.

#### 1.5 Update `frontend/vite.config.js`

In the `injectManifest.globPatterns` array, add `"**/*.json"`:

```js
injectManifest: {
  globPatterns: ["**/*.{js,css,html,svg,png,webmanifest,json}"]
}
```

This ensures any JSON assets in `public/` (e.g., webmanifest derivatives, future locale exports) are precached. The translated chunks produced by Vite's code-splitting are emitted as `.js` files and are already covered by `**/*.js`.

#### 1.6 Update `frontend/index.html`

The static `lang="en"` on `<html>` is the correct initial value (matches fallback language). The `applyLangAttribute` call in `i18n.js` will override it at runtime as soon as the detected language is known. No change needed — but verify the attribute is present.

---

### Phase 2 — T-002: String Extraction

#### 2.1 General pattern

In every file, add `import { useTranslation } from 'react-i18next';` and call `const { t } = useTranslation();` inside the component. Replace every hardcoded string with `t('key')`. For ICU plural messages pass the `count` variable as an option: `t('key', { count: n })`.

#### 2.2 Files to modify (components)

| File | Notes |
|------|-------|
| `src/components/InfoSheet.jsx` | Title, labels, button, alt text |
| `src/components/ListCardHome.jsx` | Badges, buttons, aria-labels with variable |
| `src/components/ListOptionsSheet.jsx` | Title, option labels, descriptions |
| `src/components/NewListSheet.jsx` | Title, field label, placeholder, buttons |
| `src/components/OfflineBanner.jsx` | **ICU plurals** for all 4 message variants |
| `src/components/RenameListSheet.jsx` | Title, field label, buttons |
| `src/components/ShareListSheet.jsx` | Title, labels, placeholders, buttons, dynamic squad count |
| `src/components/AddItemSheet.jsx` | Titles, labels, placeholders; **fix German strings** |
| `src/components/EntryRow.jsx` | Dynamic aria-labels, chip |
| `src/components/RecentlyUsedSection.jsx` | Section label, aria-labels |
| `src/components/AutocompleteSuggestions.jsx` | aria-label |
| `src/components/ui/ErrorState.jsx` | Title, message, button |
| `src/components/ui/FAB.jsx` | aria-label |
| `src/components/ui/LoadingState.jsx` | aria-label |
| `src/components/ui/TopBar.jsx` | aria-labels |
| `src/components/ui/BottomSheet.jsx` | aria-label |

#### 2.3 Files to modify (pages)

| File | Notes |
|------|-------|
| `src/pages/LoginPage.jsx` | Heading, paragraph, labels, buttons, links |
| `src/pages/RegisterPage.jsx` | Heading, conditional paragraph, labels, buttons, link |
| `src/pages/ForgotPasswordPage.jsx` | Heading, paragraph, label, buttons, messages |
| `src/pages/ResetPasswordPage.jsx` | Heading, paragraph, label, buttons, messages |
| `src/pages/VerifyEmailPage.jsx` | Conditional headings, paragraph, label, buttons, messages |
| `src/pages/InviteAcceptPage.jsx` | Conditional headings, status messages |
| `src/pages/OverviewPage.jsx` | Confirmation dialog text, aria-label, empty state |
| `src/pages/ListDetailPage.jsx` | Error message, badges, chip, empty states, button labels |
| `src/pages/SearchPage.jsx` | Page title |

#### 2.4 ICU plural template for OfflineBanner

```json
"offline_queued":   "Offline mode: {count, plural, one {# change} other {# changes}} waiting to sync.",
"offline_syncing":  "Syncing {count, plural, one {# queued change} other {# queued changes}}…",
"offline_waiting":  "{count, plural, one {# queued change} other {# queued changes}} still waiting to sync."
```

Usage: `t('offline.queued', { count: queuedCount })`.

---

### Phase 3 — T-003: Language Switcher UI

#### 3.1 Create `frontend/src/components/LanguageSwitcher.jsx`

- Renders a `<div role="group" aria-label={t('settings.languageLabel')}>` containing two `<button>` elements labelled `DE` and `EN`.
- Active language button gets `aria-pressed="true"` and a visually distinct style via a CSS class (e.g., `lang-btn--active`).
- On click, calls `i18next.changeLanguage(lang)` — detection plugin writes to `localStorage` automatically.
- Uses `useTranslation` to re-render when language changes.
- CSS uses existing design tokens (see `src/styles/tokens.css`): `--color-primary`, `--color-surface`, `--color-text`, `--radius-sm`, etc.

#### 3.2 Update `frontend/src/components/InfoSheet.jsx`

Add `<LanguageSwitcher />` inside a new `<div className="info-sheet-section">` below the user identity section, above the logout button.

Also add the `"settings.language"` key to the translation files so the section heading reads "Language" / "Sprache".

#### 3.3 Write `frontend/src/components/LanguageSwitcher.test.jsx`

Test cases (using React Testing Library + Vitest):
1. Renders both `DE` and `EN` buttons.
2. `EN` button has `aria-pressed="true"` when current language is `en`.
3. Clicking `DE` calls `i18next.changeLanguage('de')`.
4. After clicking `DE`, `DE` button has `aria-pressed="true"`.

Mock `i18next` via `vi.mock('i18next', ...)` and mock `react-i18next` `useTranslation` to avoid async init.

---

## Key Catalogue (abbreviated)

All keys below must exist in both `en/translation.json` and `de/translation.json`.
Keys use dot-separated namespacing within the single `translation` namespace.

```
common.cancel          common.save            common.delete
common.rename          common.close           common.back
common.retry           common.loading         common.add
common.owner           common.member          common.shared
common.queued          common.anotherMember

settings.title         settings.language      settings.languageLabel
settings.version       settings.license       settings.licenseLink
settings.logOut        settings.donate

offline.cached         offline.queued         offline.syncing
offline.waiting

list.newList           list.renameList        list.saveListName
list.cancelRename      list.createList        list.actionsFor
list.options           list.optionsRename     list.optionsRenameDesc
list.optionsShare      list.optionsShareDesc
list.deleteConfirm     list.noListsTitle      list.noListsBody
list.newListAction

detail.accessError     detail.openItems       detail.noOpenItems
detail.allClearTitle   detail.notificationsOn detail.notificationsOff
detail.owner           detail.shared

share.title            share.inviteLabel      share.invitePlaceholder
share.sendInvite       share.squadLabel       share.revoke

item.addTitle          item.editTitle         item.addLabel   item.editLabel
item.detailsLabel      item.detailsPlaceholder item.addPlaceholder
item.loadingIcon       item.suggestedIcons    item.chooseIcon
item.searchIcons       item.browseIcon        item.saveItem
item.showMore          item.showLess

entry.markOpen         entry.markDone         entry.edit

recent.sectionLabel    recent.dismiss

error.title            error.message          error.retry

fab.add                loading.label          sheet.close
topbar.back            topbar.action          autocomplete.label
search.title

auth.welcomeBack       auth.signIn            auth.email
auth.password          auth.signingIn         auth.logIn
auth.forgotPassword    auth.createAccount

auth.joinSquad         auth.createForInvite   auth.createGeneric
auth.displayName       auth.creating          auth.createAccountBtn
auth.alreadyHave

auth.resetTitle        auth.resetBody         auth.sendReset
auth.sending           auth.resetSuccess

auth.choosePassword    auth.choosePasswordBody auth.newPassword
auth.updating          auth.updatePassword    auth.resetTokenError
auth.passwordUpdated

auth.verifyTitle       auth.checkInbox        auth.verifyBody
auth.resending         auth.resendVerify      auth.emailRequired
auth.verifySuccess

invite.unavailable     invite.joining         invite.unavailableMsg
invite.connecting      invite.opening         invite.invalidLink

listCard.renameLabel   listCard.cancelRename  listCard.saveName
```

---

## Validation

```
npm run lint
npm run build
npm test
```

All three must pass with zero errors before the task is considered complete.
