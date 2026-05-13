/* global __APP_VERSION__ */
import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";
import { useAuth } from "../../context/AuthContext";
import LanguageSwitcher from "../LanguageSwitcher/LanguageSwitcher";
import { BottomSheet, Icon } from "../ui";
import styles from "./InfoSheet.module.css";

interface InfoSheetProps {
  open: boolean;
  onClose: () => void;
}

function getAppVersion(): string {
  return (globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ ?? (typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0");
}

export default function InfoSheet({ open, onClose }: InfoSheetProps): ReactElement {
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
        <div className={styles["info-sheet-section"]}>
          {user?.display_name ? <div className={styles["info-sheet-user-name"]}>{user.display_name}</div> : null}
          {user?.email ? <div className={styles["info-sheet-user-email"]}>{user.email}</div> : null}
        </div>
      ) : null}
      <div className={`${styles["info-sheet-section"]} ${styles["info-sheet-language"]}`}>
        <span className={styles["info-sheet-label"]}>{t("settings.language")}</span>
        <LanguageSwitcher />
      </div>
      <div className={styles["info-sheet-section"]}>
        <button className={`eg-btn eg-btn-danger ${styles["info-sheet-logout"]}`} type="button" onClick={handleLogout}>
          <Icon name="logOut" size={16} color="currentColor" />
          {t("settings.logOut")}
        </button>
      </div>
      <div className={`${styles["info-sheet-section"]} ${styles["info-sheet-meta"]}`}>
        <span className={styles["info-sheet-label"]}>{t("settings.version")}</span>
        <span className={styles["info-sheet-value"]}>v{appVersion}</span>
      </div>
      <div className={`${styles["info-sheet-section"]} ${styles["info-sheet-meta"]}`}>
        <span className={styles["info-sheet-label"]}>{t("settings.license")}</span>
        <a
          className={styles["info-sheet-link"]}
          href="https://www.gnu.org/licenses/gpl-3.0.html"
          rel="noopener noreferrer"
          target="_blank"
        >
          {t("settings.licenseLink")}
        </a>
      </div>
      <div className={`${styles["info-sheet-section"]} ${styles["info-sheet-donate"]}`}>
        <a href="https://www.buymeacoffee.com/derflodev" target="_blank" rel="noopener noreferrer">
          <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt={t("settings.donate")} />
        </a>
      </div>
    </BottomSheet>
  );
}
