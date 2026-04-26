import { useEffect, useState } from "react";
import { ICON_REGISTRY, ICON_REGISTRY_KEYS } from "../data/iconRegistry";
import { useIconSuggestion } from "../hooks/useIconSuggestion";
import { BottomSheet } from "./ui";

function normalizeSearchTerm(value) {
  return value.trim().toLowerCase();
}

export default function AddItemSheet({
  initialIconName = null,
  initialText = "",
  mode = "add",
  open,
  onAdd,
  onClose
}) {
  const [text, setText] = useState(initialText);
  const [selectedIconName, setSelectedIconName] = useState(initialIconName);
  const [showIconBrowser, setShowIconBrowser] = useState(false);
  const [iconBrowserSearchText, setIconBrowserSearchText] = useState("");
  const { iconName, topMatches, loading } = useIconSuggestion(text);
  const PreviewIcon = selectedIconName ? ICON_REGISTRY[selectedIconName] : null;
  const suggestedIconNames = [...new Set(topMatches)].filter((candidate) => Boolean(ICON_REGISTRY[candidate]));
  const normalizedIconBrowserSearchText = normalizeSearchTerm(iconBrowserSearchText);
  const visibleIconNames = ICON_REGISTRY_KEYS.filter((candidate) =>
    candidate.toLowerCase().includes(normalizedIconBrowserSearchText)
  );
  const isEditMode = mode === "edit";
  const textInputId = isEditMode ? "edit-item-sheet-text" : "add-item-sheet-text";
  const iconSearchInputId = isEditMode ? "edit-item-icon-browser-search" : "add-item-icon-browser-search";
  const sheetTitle = isEditMode ? "Edit Item" : "Add Item";
  const inputLabel = isEditMode ? "Edit item" : "Add item";
  const submitLabel = isEditMode ? "Save Item" : "Add Item";

  useEffect(() => {
    if (open) {
      setText(initialText);
      setSelectedIconName(initialIconName);
      setShowIconBrowser(false);
      setIconBrowserSearchText("");
      return;
    }

    setText(initialText);
    setSelectedIconName(initialIconName);
    setShowIconBrowser(false);
    setIconBrowserSearchText("");
  }, [initialIconName, initialText, open]);

  useEffect(() => {
    setSelectedIconName(iconName);
  }, [iconName]);

  async function handleSubmit(event) {
    event?.preventDefault();

    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    const submitResult = await onAdd?.(trimmed, selectedIconName);

    if (submitResult === false) {
      return;
    }

    setShowIconBrowser(false);
    setIconBrowserSearchText("");

    if (!isEditMode) {
      setText("");
      setSelectedIconName(null);
    }
  }

  return (
    <BottomSheet open={open} title={sheetTitle} onClose={onClose}>
      {showIconBrowser ? (
        <div className="add-item-icon-browser">
          <label className="visually-hidden" htmlFor={iconSearchInputId}>
            Search icons
          </label>
          <input
            id={iconSearchInputId}
            autoFocus
            className="eg-input"
            placeholder="Search icons"
            value={iconBrowserSearchText}
            onChange={(event) => setIconBrowserSearchText(event.target.value)}
          />

          <div className="add-item-icon-browser-grid">
            {visibleIconNames.map((browserIconName) => {
              const BrowserIcon = ICON_REGISTRY[browserIconName];

              return (
                <button
                  key={browserIconName}
                  aria-label={`Browse ${browserIconName}`}
                  className={`add-item-icon-browser-btn ${
                    selectedIconName === browserIconName ? "add-item-icon-browser-btn--selected" : ""
                  }`}
                  type="button"
                  onClick={() => {
                    setSelectedIconName(browserIconName);
                    setShowIconBrowser(false);
                    setIconBrowserSearchText("");
                  }}
                >
                  <BrowserIcon aria-hidden="true" size={22} stroke={1.6} />
                  <span className="icon-picker-btn-label">{browserIconName}</span>
                </button>
              );
            })}
          </div>

          <button className="eg-btn-ghost add-item-more-btn" type="button" onClick={() => setShowIconBrowser(false)}>
            Zurück
          </button>
        </div>
      ) : (
        <form className="add-item-form" onSubmit={handleSubmit}>
          <div className="eg-field">
            <label htmlFor={textInputId}>{inputLabel}</label>
            <input
              id={textInputId}
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

          <button className="eg-btn-ghost add-item-more-btn" type="button" onClick={() => setShowIconBrowser(true)}>
            Mehr anzeigen
          </button>

          <div className="button-row">
            <button className="eg-btn-ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="eg-btn-primary" disabled={!text.trim()} type="submit">
              {submitLabel}
            </button>
          </div>
        </form>
      )}
    </BottomSheet>
  );
}
