import { isValidElement } from "react";
import { useTranslation } from "react-i18next";
import Icon from "./Icon";

export default function TopBar({ title, subtitle, onBack, actions = [] }) {
  const { t } = useTranslation();

  return (
    <div className="topbar">
      {onBack ? (
        <button aria-label={t("topbar.back")} className="eg-icon-btn" type="button" onClick={onBack}>
          <Icon name="arrowLeft" size={20} color="var(--text-primary)" />
        </button>
      ) : null}
      <div className="topbar-copy">
        <div className="topbar-title">{title}</div>
        {subtitle ? <div className="topbar-subtitle">{subtitle}</div> : null}
      </div>
      {actions.map((action, index) => (
        <button
          key={action.label ?? action.ariaLabel ?? index}
          aria-label={action.ariaLabel ?? action.label ?? t("topbar.action")}
          className="eg-icon-btn"
          type="button"
          onClick={action.onClick}
        >
          {isValidElement(action.icon) ? action.icon : <Icon name={action.icon} size={20} color="var(--text-secondary)" />}
        </button>
      ))}
    </div>
  );
}
