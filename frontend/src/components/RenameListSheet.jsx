import { useEffect, useState } from "react";
import { BottomSheet } from "./ui";

export default function RenameListSheet({ open, onClose, currentName, onRename }) {
  const [value, setValue] = useState(currentName);

  useEffect(() => {
    if (open) {
      setValue(currentName);
    }
  }, [currentName, open]);

  async function handleSubmit(event) {
    event?.preventDefault();

    const trimmed = value.trim();

    if (!trimmed || trimmed === currentName) {
      return;
    }

    await onRename?.(trimmed);
    onClose?.();
  }

  return (
    <BottomSheet open={open} title="Rename List" onClose={onClose}>
      <form className="rename-list-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="eg-field">
          <label htmlFor="rename-list-sheet-value">Rename list</label>
          <input
            id="rename-list-sheet-value"
            autoFocus
            className="eg-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <div className="button-row">
          <button className="eg-btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="eg-btn-primary" disabled={!value.trim() || value.trim() === currentName} type="submit">
            Save
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
