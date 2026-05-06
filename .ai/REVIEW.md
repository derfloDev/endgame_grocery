# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

---

## Task: T-001

### Review Round 1

Status: **FAIL**

Reviewed: 2026-05-06

#### Findings

1. **[major — required]** `frontend/src/locales/de/translation.json` — entire file
   German locale file systematically replaces every umlaut and ß with ASCII digraphs throughout all 130 values (e.g. `"Loeschen"` instead of `"Löschen"`, `"Zurueck"` instead of `"Zurück"`, `"Schliessen"` instead of `"Schließen"`, `"Laedt"` instead of `"Lädt"`, `"Hinzufuegen"` instead of `"Hinzufügen"`, `"Aenderung"` instead of `"Änderung"`, `"ausstehende"` key strings, etc.).
   These render as visibly misspelled German to every German-speaking user. The locale file is an explicit T-001 deliverable (Plan §1.2) and must contain correct Unicode content.
   **Required fix:** Replace all ASCII digraph substitutions with proper German Unicode characters (ä, ö, ü, ß).

#### Required Fixes

1. Replace every `ae`→`ä`, `oe`→`ö`, `ue`→`ü`, `ss`→`ß` substitution in `frontend/src/locales/de/translation.json` with the corresponding Unicode character.
   Verify with a quick scan that no ASCII-substituted umlaut remains after the fix.

#### Verification

##### Steps
1. Read `.ai/PLAN.md` (T-001 scope confirmed: §1.1–1.6).
2. Read `frontend/src/i18n.js` — verified against Plan §1.3.
3. Read `frontend/src/main.jsx` — verified `import "./i18n"` is first import (Plan §1.4).
4. Read `frontend/vite.config.js` — verified `globPatterns` includes `json` (Plan §1.5).
5. Read `frontend/index.html` — confirmed `lang="en"` present (Plan §1.6).
6. Read `frontend/package.json` — all 5 required packages present (`i18next`, `react-i18next`, `i18next-browser-languagedetector`, `i18next-icu`, `i18next-resources-to-backend`).
7. Read `frontend/src/locales/en/translation.json` — 130 keys, correct English content, all keys from Key Catalogue present.
8. Read `frontend/src/locales/de/translation.json` — 130 keys present (key parity ✓); content uses ASCII digraphs throughout (finding #1).
9. Read `frontend/src/i18n.test.js` — tests `document.documentElement.lang` sync via `changeLanguage('de')`. Covers acceptance criterion.
10. Read `frontend/src/vite-config.test.js` — `"precaches JSON assets for offline locale delivery"` test present and passes.
11. Ran `npm run lint` → 0 errors, 1 pre-existing warning in `AuthContext.jsx` (unrelated to T-001). **PASS**.
12. Ran `npm run build` → build succeeded; emitted `dist/assets/translation-BMjHrVUO.js` and `dist/assets/translation-CXi3lF1I.js` (two separate translation chunks). SW precache includes JSON glob. **PASS**.
13. Ran `npm test` → 22 test files, 129 tests, all green. **PASS**.
14. Ran `git diff --stat HEAD` to confirm scope of changes aligns with T-001 deliverables.

##### Findings
- All T-001 acceptance criteria are met structurally (build, chunks, SW precache, lang sync).
- German locale content is incorrect: ASCII substitutions throughout (`ae/oe/ue/ss` instead of `ä/ö/ü/ß`).

##### Risks
- If German strings are committed with ASCII digraphs they will be directly visible to German-speaking users in T-002 and will require a follow-up fix touching many files; better to correct in the locale file now while only T-001 is in scope.

---

### Review Round 2

Status: **PASS**

Reviewed: 2026-05-06

#### Findings

No new findings. Required fix from Round 1 fully addressed.

- **[resolved]** `frontend/src/locales/de/translation.json` — all ASCII digraph substitutions replaced with proper Unicode characters (ä, ö, ü, ß) throughout all 130 values. Verified by direct file read and `rg` scan.
- A regression test was added (`i18n.test.js`) that asserts correct umlaut values for key entries and rejects known bad patterns — this prevents re-introduction of the issue.
- Test count increased 129 → 130 reflecting the new test case.

#### Required Fixes

None.

#### Verification

##### Steps
1. Re-read `.ai/TASKS.md` — task in `ready_for_review`, owner `review`.
2. Read `frontend/src/locales/de/translation.json` — all umlauts correct (ä, ö, ü, ß); no ASCII digraph substitutions remain.
3. Ran `rg` scan for known bad forms (`Loeschen`, `Schliessen`, `Zurueck`, `Laedt`, `Hinzufuegen`, `Aenderung`, `Oeffnen`) — zero matches in the locale file.
4. Read `frontend/src/i18n.test.js` — new regression test asserts `common.delete == "Löschen"`, `common.close == "Schließen"`, `common.back == "Zurück"`, `common.add == "Hinzufügen"`, and rejects the full set of known bad digraph forms.
5. Ran `npm run lint` → 0 errors (pre-existing `AuthContext.jsx` warning unrelated). **PASS**.
6. Ran `npm run build` → succeeded; two translation chunks emitted; SW precache 14 entries. **PASS**.
7. Ran `npm test` → 22 test files, **130 tests**, all green. **PASS**.

##### Findings
All four T-001 acceptance criteria confirmed met:
- `npm run build` succeeds ✅
- dist contains separate translation chunks for en and de ✅
- SW precache manifest includes JSON glob ✅
- `document.documentElement.lang` updates on language change ✅

German locale content now correct throughout.

##### Risks
None identified.

#### Verdict
`PASS`

---

## Task: T-002

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-05-06

#### Findings

1. **[minor]** `src/locales/en/translation.json`, `src/locales/de/translation.json` — 18 orphaned keys
   The locale files contain 146 keys each; only 126 are referenced by non-test JSX. The 18 unused keys (`common.close`, `common.back`, `common.retry`, `common.loading`, `common.add`, `list.saveListName`, `list.cancelRename`, `list.options`, `detail.owner`, `detail.shared`, `item.chooseIcon`, `item.browseIcon`, `auth.resetTokenError`, `auth.passwordUpdated`, `auth.verifyTitle`, `auth.resending`, `listCard.renameLabel`, `listCard.cancelRename`) are carry-overs from the plan's abbreviated Key Catalogue. The components use more specific or differently-named keys (e.g. `auth.resetTokenRequired` instead of `auth.resetTokenError`). The remaining 2 orphaned keys (`settings.language`, `settings.languageLabel`) are intentionally reserved for T-003.
   **Not a required fix** — does not affect any acceptance criterion. Recommend cleaning up in a future pass.

#### Required Fixes

None.

#### Verification

##### Steps
1. Re-read `.ai/TASKS.md` — T-002 in `ready_for_review`, owner `review`.
2. Re-read `.ai/PLAN.md` — T-002 scope: replace ~130 hardcoded strings; ICU plurals in OfflineBanner; fix German strings in AddItemSheet.
3. Confirmed all 25 expected files (16 components + 9 pages) import `useTranslation`. Verified via `rg -l "useTranslation"`.
4. Read `OfflineBanner.jsx` — ICU plural calls correct: `t("offline.queued", { count })`, `t("offline.syncing", { count })`, `t("offline.waiting", { count })`. ✓
5. Read `AddItemSheet.jsx` — all strings via `t()`. German strings fixed. Two new keys (`item.chooseSpecificIcon`, `item.browseSpecificIcon`) added with variable interpolation — an improvement over generic plan keys; both present in both locales. ✓
6. Read `InfoSheet.jsx`, `ListCardHome.jsx`, `OverviewPage.jsx`, `LoginPage.jsx`, `ShareListSheet.jsx`, `ListOptionsSheet.jsx`, `ResetPasswordPage.jsx`, `VerifyEmailPage.jsx` — all strings via `t()`. ✓
7. Ran Node.js key parity check: 126 unique t() keys in non-test JSX; all 126 present in both locales. ✓
8. Ran key parity check between locales: both have 146 keys, zero key set difference. ✓
9. Reviewed `vite.config.js` diff: added `test.setupFiles` pointing to `src/test/setup.js`. ✓
10. Reviewed `src/i18n.js` diff: added `typeof document === "undefined"` guard; added `react: { useSuspense: false }`. Both are correct for test environments and production. ✓
11. Reviewed `src/test/setup.js`: resets i18next to `"en"` before every test — prevents language-pollution between tests. ✓
12. Reviewed `src/app.test.jsx` diff: imports i18n; resets to `"en"` in `beforeEach`; adds a new integration test `"renders translated auth copy when German is selected"` that verifies German rendering at the app level. ✓
13. Ran `npm run lint` → 0 errors. **PASS**.
14. Ran `npm run build` → succeeded. **PASS**.
15. Ran `npm test` → 22 test files, **132 tests**, all green. **PASS**.

##### Findings
All T-002 acceptance criteria confirmed met:
- All user-visible strings rendered via `t()` ✓
- Both locale files fully populated (146 keys each, zero parity gap) ✓
- `npm run lint` passes ✓
- App renders correct language on load (verified by integration test for German) ✓

Minor: 18 orphaned locale keys (plan catalogue artefacts, not affecting runtime).

##### Risks
None identified.

#### Verdict
`PASS_WITH_NOTES`
