import { useEffect, useState } from "react";
import { ICON_REGISTRY } from "../data/iconRegistry";
import { useIconSuggestion } from "../hooks/useIconSuggestion";
import IconPickerSheet from "./IconPickerSheet";
import { BottomSheet } from "./ui";

export default function AddItemSheet({ open, onAdd, onClose }) {
  const [text, setText] = useState("");
  const [selectedIconName, setSelectedIconName] = useState(null);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const { iconName, topMatches, loading } = useIconSuggestion(text);
  const PreviewIcon = selectedIconName ? ICON_REGISTRY[selectedIconName] : null;
  const suggestedIconNames = [...new Set(topMatches)].filter((candidate) => Boolean(ICON_REGISTRY[candidate]));

  useEffect(() => {
    if (!open) {
      setText("");
      setSelectedIconName(null);
      setShowFullPicker(false);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIconName(iconName);
  }, [iconName]);

  function handleSubmit(event) {
    event?.preventDefault();

    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    onAdd?.(trimmed, selectedIconName);
    setText("");
  }

  return (
    <>
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
            ) : PreviewIcon ? (
              <div aria-live="polite" className="add-item-preview" data-testid="add-item-icon-preview">
                <PreviewIcon aria-hidden="true" className="add-item-preview-svg" size={28} stroke={1.6} />
              </div>
            ) : null}
          </div>

          {suggestedIconNames.length > 0 ? (
            <div className="add-item-icon-picker" role="group" aria-label="Suggested icons">
              {suggestedIconNames.map((suggestedIconName) => {
                const SuggestedIcon = ICON_REGISTRY[suggestedIconName];

                return (
                  <button
                    key={suggestedIconName}
                    aria-label={`Choose ${suggestedIconName}`}
                    className={`add-item-icon-picker-btn ${
                      selectedIconName === suggestedIconName ? "add-item-icon-picker-btn--selected" : ""
                    }`}
                    type="button"
                    onClick={() => setSelectedIconName(suggestedIconName)}
                  >
                    <SuggestedIcon aria-hidden="true" size={20} stroke={1.6} />
                  </button>
                );
              })}
            </div>
          ) : null}

          <button className="eg-btn-ghost add-item-more-btn" type="button" onClick={() => setShowFullPicker(true)}>
            Mehr anzeigen
          </button>

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

      <IconPickerSheet
        open={showFullPicker}
        selectedIconName={selectedIconName}
        onClose={() => setShowFullPicker(false)}
        onSelect={setSelectedIconName}
      />
    </>
  );
}
