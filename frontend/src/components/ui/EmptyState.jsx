import Icon from "./Icon";

export default function EmptyState({ title, body, action, onAction }) {
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
