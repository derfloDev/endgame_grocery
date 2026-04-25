import { BottomSheet, Icon } from "./ui";

export default function ListOptionsSheet({ open, onClose, isOwner, onRenameSelect, onShareSelect }) {
  if (!open || !isOwner) {
    return null;
  }

  return (
    <BottomSheet open={open} title="List Options" onClose={onClose}>
      <div className="list-options-sheet">
        <button
          className="list-option-row"
          type="button"
          onClick={() => {
            onClose?.();
            onRenameSelect?.();
          }}
        >
          <div className="list-option-icon list-option-icon-edit">
            <Icon color="var(--neon-violet)" name="edit" size={22} />
          </div>
          <div className="list-option-text">
            <span className="list-option-label">Rename list</span>
            <span className="list-option-desc">Change the name of this list</span>
          </div>
          <Icon color="var(--text-disabled)" name="chevronRight" size={16} />
        </button>

        <button
          className="list-option-row"
          type="button"
          onClick={() => {
            onClose?.();
            onShareSelect?.();
          }}
        >
          <div className="list-option-icon list-option-icon-share">
            <Icon color="var(--neon-cyan)" name="share" size={22} />
          </div>
          <div className="list-option-text">
            <span className="list-option-label">Share list</span>
            <span className="list-option-desc">Manage squad access</span>
          </div>
          <Icon color="var(--text-disabled)" name="chevronRight" size={16} />
        </button>
      </div>
    </BottomSheet>
  );
}
