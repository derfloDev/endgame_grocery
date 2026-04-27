/* global __APP_VERSION__ */
import { useAuth } from "../context/AuthContext";
import { BottomSheet, Icon } from "./ui";

function getAppVersion() {
  return globalThis.__APP_VERSION__ ?? (typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0");
}

export default function InfoSheet({ open, onClose }) {
  const { logout } = useAuth();
  const appVersion = getAppVersion();

  function handleLogout() {
    onClose();
    logout();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Info & Settings">
      <div className="info-sheet-section">
        <button className="eg-btn eg-btn-danger info-sheet-logout" type="button" onClick={handleLogout}>
          <Icon name="logOut" size={16} color="currentColor" />
          Log out
        </button>
      </div>
      <div className="info-sheet-section info-sheet-meta">
        <span className="info-sheet-label">Version</span>
        <span className="info-sheet-value">v{appVersion}</span>
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
