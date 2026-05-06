/* global __APP_VERSION__ */
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import LanguageSwitcher from "./LanguageSwitcher";
import { BottomSheet, Icon } from "./ui";

function getAppVersion() {
  return globalThis.__APP_VERSION__ ?? (typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0");
}

export default function InfoSheet({ open, onClose }) {
  const { t } = useTranslation();
  const { logout, user } = useAuth();
  const appVersion = getAppVersion();
  const showUserIdentity = Boolean(user?.display_name || user?.email);

  function handleLogout() {
    onClose();
    logout();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t("settings.title")}>
      {showUserIdentity ? (
        <div className="info-sheet-section">
          {user?.display_name ? <div className="info-sheet-user-name">{user.display_name}</div> : null}
          {user?.email ? <div className="info-sheet-user-email">{user.email}</div> : null}
        </div>
      ) : null}
      <div className="info-sheet-section info-sheet-language">
        <span className="info-sheet-label">{t("settings.language")}</span>
        <LanguageSwitcher />
      </div>
      <div className="info-sheet-section">
        <button className="eg-btn eg-btn-danger info-sheet-logout" type="button" onClick={handleLogout}>
          <Icon name="logOut" size={16} color="currentColor" />
          {t("settings.logOut")}
        </button>
      </div>
      <div className="info-sheet-section info-sheet-meta">
        <span className="info-sheet-label">{t("settings.version")}</span>
        <span className="info-sheet-value">v{appVersion}</span>
      </div>
      <div className="info-sheet-section info-sheet-meta">
        <span className="info-sheet-label">{t("settings.license")}</span>
        <a
          className="info-sheet-link"
          href="https://www.gnu.org/licenses/gpl-3.0.html"
          rel="noopener noreferrer"
          target="_blank"
        >
          {t("settings.licenseLink")}
        </a>
      </div>
      <div className="info-sheet-section info-sheet-donate">
        <a href="https://www.buymeacoffee.com/derflodev" target="_blank" rel="noopener noreferrer">
          <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt={t("settings.donate")} />
        </a>
      </div>
    </BottomSheet>
  );
}
