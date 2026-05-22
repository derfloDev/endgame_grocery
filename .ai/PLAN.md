# Plan

Status: **ready_for_implement**

Goal: Redesign the "Info & Settings" BottomSheet for clarity and fix the broken API-key copy button.

## Scope

- Reorder sections: Language → User identity → API Key → Logout → Meta footer
- Add visible section labels (all-caps, with decorative divider lines on each side)
- Add top-border dividers between all sections
- Fix `handleCopyApiKey`: wrap `navigator.clipboard.writeText` in try/catch so clipboard errors do not silently fail
- Add new i18n key `settings.account` ("Account" / "Konto") for the user-identity section header
- Update unit tests to cover the new section order and the clipboard error path

## Acceptance Criteria

1. Language switcher is the first rendered section inside the sheet.
2. Every section has a small all-caps label rendered as `─── LABEL ───` (text flanked by decorative lines via CSS `::before`/`::after` pseudo-elements).
3. Sections are separated by a thin border-top divider.
4. Clicking "Copy" when `navigator.clipboard.writeText` rejects does not silently fail; the button remains usable on retry.
5. All existing unit tests pass without modification to assertions; tests for changed order and clipboard error path are added.
6. `npm run lint`, `npm run build`, and `npm test` all pass.

## Implementation Phases

### Phase 1 – i18n additions

Add the new `settings.account` translation key to both locale files.

**Files:**
- `frontend/src/locales/en/translation.json` — add `"settings.account": "Account"`
- `frontend/src/locales/de/translation.json` — add `"settings.account": "Konto"`

### Phase 2 – CSS redesign

Rework `InfoSheet.module.css` to support the new section-label and divider pattern.

**Changes:**
- `.info-sheet-section` — add `padding-top: var(--space-4)` and `border-top: 1px solid rgba(255, 255, 255, 0.08)` so every section gets a top divider.
- `.info-sheet-section:first-of-type` — remove top border and top padding (first section needs no divider above it; achieved via a dedicated `.info-sheet-section--first` modifier class applied in JSX, since `:first-of-type` alone may not be reliable with conditional siblings).
- `.info-sheet-section-label` — new rule: `display: flex; align-items: center; gap: 8px; margin-bottom: var(--space-2); color: var(--text-secondary); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;` with `::before` and `::after` as `flex: 1; height: 1px; background: rgba(255, 255, 255, 0.08); content: ''`.
- `.info-sheet-meta` — remove standalone `border-top` (now provided by the section divider pattern); keep `display: flex`, `justify-content: space-between`, and `gap`.
- `.info-sheet-donate` — remove standalone `padding-top` (now provided by the section).
- `.info-sheet-language` — keep or remove `display: grid; gap` (now layout is handled by the section wrapper).
- `.info-sheet-api-key` — keep `display: grid; gap: var(--space-3)`.
- Remove `.info-sheet-api-key-header` (replaced by the section-label pattern; "Copied!" feedback moves to a standalone `aria-live` row).

### Phase 3 – JSX reorder and clipboard fix

Rewrite the JSX of `InfoSheet.tsx` in the new order and fix the clipboard handler.

**New section order:**
```
<BottomSheet …>

  {/* 1. Language — first section, no top divider */}
  <div className="info-sheet-section info-sheet-section--first">
    <div className="info-sheet-section-label">{t("settings.language")}</div>
    <LanguageSwitcher />
  </div>

  {/* 2. Account — user name + e-mail; rendered only when identity exists */}
  {showUserIdentity && (
    <div className="info-sheet-section">
      <div className="info-sheet-section-label">{t("settings.account")}</div>
      {user?.display_name && <div className="info-sheet-user-name">…</div>}
      {user?.email && <div className="info-sheet-user-email">…</div>}
    </div>
  )}

  {/* 3. API Key */}
  <div className="info-sheet-section info-sheet-api-key">
    <div className="info-sheet-section-label">{t("settings.apiKey")}</div>
    <p className="info-sheet-api-key-hint">…</p>
    {apiKey ? (
      <>
        <div className="info-sheet-api-key-row">
          <code …>{apiKey}</code>
          <button … onClick={handleCopyApiKey}>{t("settings.apiKeyCopy")}</button>
        </div>
        {copySuccess && (
          <span className="info-sheet-api-key-status" aria-live="polite">
            {t("settings.apiKeyCopied")}
          </span>
        )}
        <button … onClick={handleRegenerateApiKey}>{t("settings.apiKeyRegenerate")}</button>
      </>
    ) : (
      <>
        <p …>{apiKeyLoaded ? t("settings.apiKeyNone") : t("common.loading")}</p>
        <button … onClick={handleRegenerateApiKey}>{t("settings.apiKeyGenerate")}</button>
      </>
    )}
  </div>

  {/* 4. Logout */}
  <div className="info-sheet-section">
    <button className="eg-btn eg-btn-danger info-sheet-logout" …>{t("settings.logOut")}</button>
  </div>

  {/* 5. Meta — Version */}
  <div className="info-sheet-section info-sheet-meta">
    <span className="info-sheet-label">{t("settings.version")}</span>
    <span className="info-sheet-value">v{appVersion}</span>
  </div>

  {/* 6. Meta — License */}
  <div className="info-sheet-section info-sheet-meta">
    <span className="info-sheet-label">{t("settings.license")}</span>
    <a …>{t("settings.licenseLink")}</a>
  </div>

  {/* 7. Donate */}
  <div className="info-sheet-section info-sheet-donate">
    <a …><img … /></a>
  </div>

</BottomSheet>
```

**Clipboard fix** — replace:
```ts
async function handleCopyApiKey() {
  if (!apiKey) return;
  await navigator.clipboard.writeText(apiKey);
  setCopySuccess(true);
}
```
with:
```ts
async function handleCopyApiKey() {
  if (!apiKey) return;
  try {
    await navigator.clipboard.writeText(apiKey);
    setCopySuccess(true);
  } catch {
    // clipboard write failed (insecure context or permission denied); do nothing
  }
}
```

### Phase 4 – Test updates

Update `InfoSheet.test.tsx`:

1. **Existing test** `"renders the user identity block before the logout action"` — still passes as-is (user name remains before logout in the new order).
2. **New test** `"renders the language switcher before the user identity block"` — assert `languageSwitcherGroup.compareDocumentPosition(userName) & DOCUMENT_POSITION_FOLLOWING`.
3. **New test** `"does not crash when clipboard write fails"` — stub `navigator.clipboard.writeText` to `mockRejectedValue`, click Copy, assert no "Copied!" text appears and the button is still present/usable.

## Validation

```
npm run lint
npm run build
npm test
```
