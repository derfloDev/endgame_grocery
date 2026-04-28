import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ICON_REGISTRY, ICON_REGISTRY_KEYS } from "../data/iconRegistry";
import { useAutocomplete } from "../hooks/useAutocomplete";
import { useIconSuggestion } from "../hooks/useIconSuggestion";
import AutocompleteSuggestions from "./AutocompleteSuggestions";
import { BottomSheet } from "./ui";

function normalizeSearchTerm(value) {
  return value.trim().toLowerCase();
}

export default function AddItemSheet({
  initialDetails = "",
  initialIconName = null,
  initialText = "",
  listId = "",
  mode = "add",
  open,
  onAdd,
  onClose
}) {
  const { token } = useAuth();
  const [text, setText] = useState(initialText);
  const [details, setDetails] = useState(initialDetails);
  const [selectedIconName, setSelectedIconName] = useState(initialIconName);
  const [showIconBrowser, setShowIconBrowser] = useState(false);
  const [iconBrowserSearchText, setIconBrowserSearchText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputAnchorRef = useRef(null);
  const iconSearchRef = useRef(null);
  const { iconName, topMatches, loading } = useIconSuggestion(text);
  const isEditMode = mode === "edit";
  const { suggestions } = useAutocomplete(listId, isEditMode ? "" : text, token);
  const PreviewIcon = selectedIconName ? ICON_REGISTRY[selectedIconName] : null;
  const suggestedIconNames = [...new Set(topMatches)].filter((candidate) => Boolean(ICON_REGISTRY[candidate]));
  const normalizedIconBrowserSearchText = normalizeSearchTerm(iconBrowserSearchText);
  const visibleIconNames = ICON_REGISTRY_KEYS.filter((candidate) =>
    candidate.toLowerCase().includes(normalizedIconBrowserSearchText)
  );
  const textInputId = isEditMode ? "edit-item-sheet-text" : "add-item-sheet-text";
  const detailsInputId = isEditMode ? "edit-item-sheet-details" : "add-item-sheet-details";
  const iconSearchInputId = isEditMode ? "edit-item-icon-browser-search" : "add-item-icon-browser-search";
  const sheetTitle = isEditMode ? "Edit Item" : "Add Item";
  const inputLabel = isEditMode ? "Edit item" : "Add item";
  const submitLabel = isEditMode ? "Save Item" : "Add Item";
  const iconBrowserToggleLabel = showIconBrowser ? "Weniger anzeigen" : "Mehr anzeigen";
  const sheetClassName = showIconBrowser ? "bottom-sheet--browser-open" : "";

  useEffect(() => {
    setText(initialText);
    setDetails(initialDetails);
    setSelectedIconName(initialIconName);
    setShowIconBrowser(false);
    setIconBrowserSearchText("");
    setShowSuggestions(false);
  }, [initialDetails, initialIconName, initialText, open]);

  useEffect(() => {
    setSelectedIconName(iconName);
  }, [iconName]);

  useEffect(() => {
    if (!showSuggestions) {
      return;
    }

    function handlePointerOutside(event) {
      if (inputAnchorRef.current && !inputAnchorRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handlePointerOutside);
    document.addEventListener("touchstart", handlePointerOutside);

    return () => {
      document.removeEventListener("mousedown", handlePointerOutside);
      document.removeEventListener("touchstart", handlePointerOutside);
    };
  }, [showSuggestions]);

  useEffect(() => {
    if (!showIconBrowser) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      iconSearchRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showIconBrowser]);

  function handleInputChange(event) {
    const value = event.target.value;

    setText(value);
    setShowSuggestions(value.trim().length >= 2);
  }

  function handleInputFocus() {
    if (!isEditMode && text.trim().length >= 2) {
      setShowSuggestions(true);
    }
  }

  async function handleQuickAdd(suggestedText, suggestedIconName) {
    const trimmed = suggestedText.trim();

    if (!trimmed) {
      return;
    }

    // Keep the add sheet open after a successful chip tap so users can continue adding items.
    const submitResult = await onAdd?.(trimmed, suggestedIconName, "");

    if (submitResult === false) {
      return;
    }

    setShowSuggestions(false);
    setShowIconBrowser(false);
    setIconBrowserSearchText("");
    setDetails("");
    setText("");
    setSelectedIconName(null);
  }

  async function handleSubmit(event) {
    event?.preventDefault();

    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    const submitResult = await onAdd?.(trimmed, selectedIconName, details);

    if (submitResult === false) {
      return;
    }

    setShowSuggestions(false);
    setShowIconBrowser(false);
    setIconBrowserSearchText("");

    if (!isEditMode) {
      setDetails("");
      setText("");
      setSelectedIconName(null);
    }
  }

  return (
    <BottomSheet className={sheetClassName} open={open} title={sheetTitle} onClose={onClose}>
      <form className="add-item-form" onSubmit={handleSubmit}>
        <div className="eg-field">
          <label htmlFor={textInputId}>{inputLabel}</label>
          <div className="eg-input-wrap">
            <div className="eg-input-anchor" ref={inputAnchorRef}>
              <input
                id={textInputId}
                autoComplete="off"
                autoFocus={!showIconBrowser}
                className="eg-input"
                placeholder="Add milk, lemons, bread..."
                value={text}
                onFocus={handleInputFocus}
                onChange={handleInputChange}
              />
              {showSuggestions && !isEditMode ? (
                <AutocompleteSuggestions suggestions={suggestions} onSelect={handleQuickAdd} />
              ) : null}
            </div>
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
        </div>

        <div className="eg-field">
          <label htmlFor={detailsInputId}>Details (optional)</label>
          <input
            id={detailsInputId}
            className="eg-input"
            placeholder="Beschreibung, Menge..."
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
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

        <button
          className="eg-btn-ghost add-item-more-btn"
          type="button"
          onClick={() => setShowIconBrowser((currentValue) => !currentValue)}
        >
          {iconBrowserToggleLabel}
        </button>

        <div
          aria-hidden={!showIconBrowser}
          className={`add-item-icon-browser${showIconBrowser ? " add-item-icon-browser--open" : ""}`}
          inert={!showIconBrowser || undefined}
        >
          <div className="add-item-icon-browser-inner">
            <label className="visually-hidden" htmlFor={iconSearchInputId}>
              Search icons
            </label>
            <input
              ref={iconSearchRef}
              id={iconSearchInputId}
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
          </div>
        </div>

        <div className="button-row">
          <button className="eg-btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="eg-btn-primary" disabled={!text.trim()} type="submit">
            {submitLabel}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
