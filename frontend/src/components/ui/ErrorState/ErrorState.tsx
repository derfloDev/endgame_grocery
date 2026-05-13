import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";
import Icon from "../Icon/Icon";
import styles from "./ErrorState.module.css";

interface ErrorStateProps {
  onRetry: () => void;
}

export default function ErrorState({ onRetry }: ErrorStateProps): ReactElement {
  const { t } = useTranslation();

  return (
    <div className={styles["error-state"]}>
      <Icon name="alertCircle" size={48} color="var(--color-error)" />
      <div className={styles["error-state-title"]}>{t("error.title")}</div>
      <div className={styles["error-state-body"]}>{t("error.message")}</div>
      <button className={`eg-btn-secondary ${styles["error-state-action"]}`} type="button" onClick={onRetry}>
        {t("error.retry")}
      </button>
    </div>
  );
}
