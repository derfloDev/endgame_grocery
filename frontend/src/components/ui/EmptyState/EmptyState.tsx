import type { ReactElement } from "react";
import Icon from "../Icon/Icon";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}

export default function EmptyState({ title, body, action, onAction }: EmptyStateProps): ReactElement {
  return (
    <div className={styles["empty-state"]}>
      <Icon name="shoppingCart" size={56} color="var(--text-disabled)" />
      <div className={styles["empty-state-title"]}>{title}</div>
      <div className={styles["empty-state-body"]}>{body}</div>
      {action ? (
        <button className={`eg-btn-primary ${styles["empty-state-action"]}`} type="button" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}
