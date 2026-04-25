import { useEffect, useState } from "react";
import { useIconSuggestion } from "../hooks/useIconSuggestion";
import { BottomSheet } from "./ui";

export default function AddItemSheet({ open, onAdd, onClose }) {
  const [text, setText] = useState("");
  const { iconName, loading } = useIconSuggestion(text);

  useEffect(() => {
    if (!open) {
      setText("");
    }
  }, [open]);

  function handleSubmit(event) {
    event?.preventDefault();

    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    onAdd?.(trimmed, iconName);
    setText("");
  }

  return (
    <BottomSheet open={open} title="Add Item" onClose={onClose}>
      <form className="add-item-form" onSubmit={handleSubmit}>
        <div className="eg-field">
          <label htmlFor="add-item-sheet-text">Add item</label>
          <input
            id="add-item-sheet-text"
            autoFocus
            className="eg-input"
            placeholder="Add milk, lemons, bread..."
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {loading ? (
            <div aria-live="polite" className="add-item-preview add-item-preview-loading">
              <span aria-label="Loading icon suggestion" className="add-item-preview-spinner" />
            </div>
          ) : iconName ? (
            <div aria-live="polite" className="add-item-preview">
              <span aria-hidden="true" className="add-item-preview-icon">
                {iconName}
              </span>
            </div>
          ) : null}
        </div>
        <div className="button-row">
          <button className="eg-btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="eg-btn-primary" disabled={!text.trim()} type="submit">
            Add Item
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
