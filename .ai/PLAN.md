# Plan

Status: **ready_for_implement**

Goal: Add a settings/info button to the top right of the OverviewPage that opens a bottom sheet with logout, version info, and license info.

---

## T-002 — InfoSheet: Settings Button & Info Bottom Sheet

### Scope

- Replace the direct logout button in `OverviewPage` with a `settings` icon button (top right).
- Clicking the button opens a new `InfoSheet` bottom sheet.
- The sheet contains three sections:
  1. **Logout** — a full-width logout button that calls `logout()` from `useAuth` and closes the sheet.
  2. **Version** — displays the app version injected at build time from the root `package.json`.
  3. **License** — displays "GNU General Public License v3.0" as a link to `https://www.gnu.org/licenses/gpl-3.0.html`.

### Acceptance Criteria

- A `settings` gear icon button appears top-right in `OverviewPage`; the standalone logout button is removed from the header.
- Clicking the button opens a bottom sheet titled "Info & Settings".
- The sheet renders a logout button, a version row (`v0.2.0` or current), and a license row with a link.
- Clicking logout closes the sheet and logs the user out.
- Clicking the backdrop closes the sheet without logging out.
- `npm run lint` passes.
- `npm run build` passes.
- `npm test` passes (unit tests cover InfoSheet render and interactions).

### Implementation Phases

#### Phase 1 — `settings` icon in Icon.jsx

- Add `settings` entry to `iconPaths` in `frontend/src/components/ui/Icon.jsx`:
  ```jsx
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  ```

#### Phase 2 — App version injection in vite.config.js

- In `frontend/vite.config.js`, import the root `package.json` and define `__APP_VERSION__`:
  ```js
  import { readFileSync } from "node:fs";
  import { fileURLToPath } from "node:url";
  import { resolve, dirname } from "node:path";

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const rootPkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf-8"));

  // Inside defineConfig:
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
  },
  ```
- Add `/* global __APP_VERSION__ */` JSDoc comment in `InfoSheet.jsx` so ESLint does not flag the global.

#### Phase 3 — InfoSheet component

- Create `frontend/src/components/InfoSheet.jsx`:
  ```jsx
  /* global __APP_VERSION__ */
  import { useAuth } from "../context/AuthContext";
  import { Icon } from "./ui";
  import BottomSheet from "./ui/BottomSheet";

  export default function InfoSheet({ open, onClose }) {
    const { logout } = useAuth();

    function handleLogout() {
      logout();
      onClose();
    }

    return (
      <BottomSheet open={open} onClose={onClose} title="Info & Settings">
        <div className="info-sheet-section">
          <button className="eg-btn eg-btn-danger" type="button" onClick={handleLogout}>
            <Icon name="logOut" size={16} color="currentColor" />
            Log out
          </button>
        </div>
        <div className="info-sheet-section info-sheet-meta">
          <span className="info-sheet-label">Version</span>
          <span className="info-sheet-value">v{__APP_VERSION__}</span>
        </div>
        <div className="info-sheet-section info-sheet-meta">
          <span className="info-sheet-label">License</span>
          <a
            className="info-sheet-link"
            href="https://www.gnu.org/licenses/gpl-3.0.html"
            rel="noopener noreferrer"
            target="_blank"
          >
            GNU GPL v3.0
          </a>
        </div>
      </BottomSheet>
    );
  }
  ```

#### Phase 4 — OverviewPage integration

- In `frontend/src/pages/OverviewPage.jsx`:
  - Import `InfoSheet`.
  - Add `const [showInfo, setShowInfo] = useState(false);`.
  - Replace the logout `<button>` in `overview-actions` with:
    ```jsx
    <button aria-label="Settings" className="eg-icon-btn" type="button" onClick={() => setShowInfo(true)}>
      <Icon name="settings" color="var(--text-secondary)" size={18} />
    </button>
    ```
  - Add `<InfoSheet open={showInfo} onClose={() => setShowInfo(false)} />` alongside `<NewListSheet>`.

#### Phase 5 — CSS

- Add to `frontend/src/index.css` (near other sheet styles):
  ```css
  .info-sheet-section {
    padding: 0 1rem 1rem;
  }
  .info-sheet-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
  }
  .info-sheet-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  .info-sheet-value {
    font-size: 0.85rem;
    color: var(--text-primary);
  }
  .info-sheet-link {
    font-size: 0.85rem;
    color: var(--neon-cyan, var(--neon-violet));
    text-decoration: none;
  }
  .info-sheet-link:hover {
    text-decoration: underline;
  }
  ```

#### Phase 6 — Tests

- Create `frontend/src/components/InfoSheet.test.jsx`:
  - Renders correctly when `open={true}`.
  - Does not render when `open={false}`.
  - Clicking logout button calls `logout()` from `useAuth` and calls `onClose`.
  - Clicking backdrop calls `onClose` without calling `logout`.
  - Displays version string containing `__APP_VERSION__` value.
  - Displays a link with text "GNU GPL v3.0".

### Validation

- `npm run lint`
- `npm run build`
- `npm test`

---

## T-001 — Add GNU GPL v3 license *(done)*

See previous cycle entry.
