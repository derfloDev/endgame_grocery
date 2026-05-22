# ROADMAP

Goal: Redesign the "Info & Settings" bottom sheet for better clarity and fix the broken API-key copy button.

## Priority 1

Objective: Restructure and visually improve the InfoSheet bottom sheet.

**New section order (top to bottom):**
1. Language toggle (always at top)
2. User identity (display name + e-mail) — with section label
3. API Key — with section label (label, hint, key value, Copy / Regenerate)
4. Logout button
5. Meta footer: Version | License | Donate

**Visual style:**
- Thin horizontal dividers between sections
- Small all-caps section label above each group (e.g. "SPRACHE", "API KEY", "KONTO")
- No cards / panels — flat list with dividers

**Bug fix:**
- `handleCopyApiKey` swallows clipboard errors silently (async without try/catch).
  Add error handling so the button never appears to do nothing.

**Acceptance criteria:**
- Language toggle is rendered before all other sections.
- Each section has a visible label header.
- Sections are separated by a thin divider.
- Clicking "Copy" writes the API key to the clipboard and shows "Copied!" feedback; clipboard errors do not leave the button in a silent broken state.
- All existing unit tests pass; new/updated tests cover the changed section order and the clipboard error path.
