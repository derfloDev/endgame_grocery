import { RefreshCw, X } from "lucide-react";
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useServiceWorkerUpdate } from "../../sw/register";
import styles from "./UpdateBanner.module.css";

const DISMISSED_KEY = "endgame_grocery.update_banner_dismissed";

function getDismissedForSession(): boolean {
  return window.sessionStorage.getItem(DISMISSED_KEY) === "true";
}

export default function UpdateBanner(): ReactElement | null {
  const { t } = useTranslation();
  const { dismissUpdate, needRefresh, updateServiceWorker } = useServiceWorkerUpdate();
  const [dismissed, setDismissed] = useState(getDismissedForSession);

  if (!needRefresh || dismissed) {
    return null;
  }

  function handleDismiss(): void {
    window.sessionStorage.setItem(DISMISSED_KEY, "true");
    dismissUpdate();
    setDismissed(true);
  }

  return (
    <section className={styles["update-banner"]} role="status" aria-live="polite">
      <span className={styles["update-banner-text"]}>{t("update.bannerText")}</span>
      <span className={styles["update-banner-actions"]}>
        <button
          className={styles["update-banner-action"]}
          type="button"
          onClick={() => void updateServiceWorker(true)}
        >
          <RefreshCw aria-hidden="true" size={16} strokeWidth={2} />
          <span>{t("update.bannerAction")}</span>
        </button>
        <button
          aria-label={t("common.close")}
          className={styles["update-banner-dismiss"]}
          type="button"
          onClick={handleDismiss}
        >
          <X aria-hidden="true" size={16} strokeWidth={2} />
        </button>
      </span>
    </section>
  );
}
