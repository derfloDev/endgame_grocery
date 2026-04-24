import Icon from "./Icon";

export default function ErrorState({ onRetry }) {
  return (
    <div className="error-state">
      <Icon name="alertCircle" size={48} color="var(--color-error)" />
      <div className="error-state-title">Mission Failed</div>
      <div className="error-state-body">Something went wrong. Try again.</div>
      <button className="eg-btn-secondary error-state-action" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
