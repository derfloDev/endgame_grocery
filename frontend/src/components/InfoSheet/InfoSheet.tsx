/* global __APP_VERSION__ */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";
import { fetchApiKey, regenerateApiKey } from "../../api/auth";
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
  const { logout, token, user } = useAuth();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const appVersion = getAppVersion();
  const showUserIdentity = Boolean(user?.display_name || user?.email);

  useEffect(() => {
    if (!open || !token) {
      return;
    }

    let cancelled = false;

    setApiKeyLoaded(false);
    setCopySuccess(false);
    fetchApiKey(token)
      .then((result) => {
        if (!cancelled) {
          setApiKey(result.api_key);
          setApiKeyLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiKey(null);
          setApiKeyLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, token]);

  useEffect(() => {
    if (!copySuccess) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopySuccess(false);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copySuccess]);

  function handleLogout() {
    onClose();
    logout();
  }

  async function handleCopyApiKey() {
    if (!apiKey) {
      return;
    }

    await navigator.clipboard.writeText(apiKey);
    setCopySuccess(true);
  }

  async function handleRegenerateApiKey() {
    if (!token) {
      return;
    }

    setRegenerating(true);
    setCopySuccess(false);
    try {
      const result = await regenerateApiKey(token);
      setApiKey(result.api_key);
      setApiKeyLoaded(true);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t("settings.title")}>
      {showUserIdentity ? (
        <div className={styles["info-sheet-section"]}>
          {user?.display_name ? <div className={styles["info-sheet-user-name"]}>{user.display_name}</div> : null}
          {user?.email ? <div className={styles["info-sheet-user-email"]}>{user.email}</div> : null}
        </div>
      ) : null}
      <div className={`${styles["info-sheet-section"]} ${styles["info-sheet-api-key"]}`}>
        <div className={styles["info-sheet-api-key-header"]}>
          <span className={styles["info-sheet-label"]}>{t("settings.apiKey")}</span>
          {copySuccess ? (
            <span className={styles["info-sheet-api-key-status"]} aria-live="polite">
              {t("settings.apiKeyCopied")}
            </span>
          ) : null}
        </div>
        <p className={styles["info-sheet-api-key-hint"]}>{t("settings.apiKeyHint")}</p>
        {apiKey ? (
          <>
            <div className={styles["info-sheet-api-key-row"]}>
              <code className={styles["info-sheet-api-key-value"]}>{apiKey}</code>
              <button className="eg-btn-secondary" type="button" onClick={handleCopyApiKey}>
                {t("settings.apiKeyCopy")}
              </button>
            </div>
            <button className="eg-btn-ghost" type="button" disabled={regenerating} onClick={handleRegenerateApiKey}>
              <Icon name="plus" size={16} color="currentColor" />
              {t("settings.apiKeyRegenerate")}
            </button>
          </>
        ) : (
          <>
            <p className={styles["info-sheet-api-key-empty"]}>
              {apiKeyLoaded ? t("settings.apiKeyNone") : t("common.loading")}
            </p>
            <button
              className="eg-btn-secondary"
              type="button"
              disabled={!apiKeyLoaded || regenerating}
              onClick={handleRegenerateApiKey}
            >
              <Icon name="plus" size={16} color="currentColor" />
              {t("settings.apiKeyGenerate")}
            </button>
          </>
        )}
      </div>
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
