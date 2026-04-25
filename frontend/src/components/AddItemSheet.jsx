import { useEffect, useState } from "react";
import { BottomSheet } from "./ui";

export default function AddItemSheet({ open, onAdd, onClose }) {
  const [text, setText] = useState("");

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

    onAdd?.(trimmed);
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
