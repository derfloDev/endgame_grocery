import { useEffect, useState } from "react";
import { BottomSheet } from "./ui";

export default function NewListSheet({ open, onAdd, onClose }) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
    }
  }, [open]);

  function handleSubmit(event) {
    event?.preventDefault();

    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    onAdd?.(trimmed);
    setName("");
    onClose?.();
  }

  return (
    <BottomSheet open={open} title="New List" onClose={onClose}>
      <form className="new-list-form" onSubmit={handleSubmit}>
        <div className="eg-field">
          <label htmlFor="new-list-sheet-name">New list</label>
          <input
            id="new-list-sheet-name"
            autoFocus
            className="eg-input"
            placeholder="Weekend groceries"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="button-row">
          <button className="eg-btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="eg-btn-primary" disabled={!name.trim()} type="submit">
            Create list
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
