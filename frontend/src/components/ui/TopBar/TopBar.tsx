import { isValidElement } from "react";
import { useTranslation } from "react-i18next";
import Icon from "../Icon/Icon";
import styles from "./TopBar.module.css";
import type { IconName } from "../Icon/Icon";
import type { ReactElement, ReactNode } from "react";

interface TopBarAction {
  ariaLabel?: string;
  icon: IconName | string | ReactNode;
  label?: string;
  onClick: () => void;
}

interface TopBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: TopBarAction[];
}

export default function TopBar({ title, subtitle, onBack, actions = [] }: TopBarProps): ReactElement {
  const { t } = useTranslation();

  return (
    <div className={styles.topbar}>
      {onBack ? (
        <button aria-label={t("topbar.back")} className="eg-icon-btn" type="button" onClick={onBack}>
          <Icon name="arrowLeft" size={20} color="var(--text-primary)" />
        </button>
      ) : null}
      <div className={styles["topbar-copy"]}>
        <div className={styles["topbar-title"]}>{title}</div>
        {subtitle ? <div className={styles["topbar-subtitle"]}>{subtitle}</div> : null}
      </div>
      {actions.map((action, index) => (
        <button
          key={action.label ?? action.ariaLabel ?? index}
          aria-label={action.ariaLabel ?? action.label ?? t("topbar.action")}
          className="eg-icon-btn"
          type="button"
          onClick={action.onClick}
        >
          {isValidElement(action.icon) ? (
            action.icon
          ) : (
            <Icon name={String(action.icon)} size={20} color="var(--text-secondary)" />
          )}
        </button>
      ))}
    </div>
  );
}
