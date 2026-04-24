import { isValidElement } from "react";
import Icon from "./Icon";

export default function TopBar({ title, subtitle, onBack, actions = [] }) {
  return (
    <div className="topbar">
      {onBack ? (
        <button aria-label="Back" className="eg-icon-btn" type="button" onClick={onBack}>
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
          aria-label={action.ariaLabel ?? action.label ?? "Action"}
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
