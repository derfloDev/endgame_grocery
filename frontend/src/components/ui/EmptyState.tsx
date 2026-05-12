import type { ReactElement } from "react";
import Icon from "./Icon";

interface EmptyStateProps {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}

export default function EmptyState({ title, body, action, onAction }: EmptyStateProps): ReactElement {
  return (
    <div className="empty-state">
      <Icon name="shoppingCart" size={56} color="var(--text-disabled)" />
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-body">{body}</div>
      {action ? (
        <button className="eg-btn-primary empty-state-action" type="button" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}
