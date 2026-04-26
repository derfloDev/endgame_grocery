import { useEffect, useRef, useState } from "react";
import { FALLBACK_ICON, ICON_REGISTRY, ICON_REGISTRY_KEYS } from "../data/iconRegistry";
import IconPickerSheet from "./IconPickerSheet";
import { Icon } from "./ui";

const FALLBACK_ICON_NAME = "IconShoppingCart";

function normalizeSelectedIconName(iconName) {
  if (iconName == null) {
    return null;
  }

  return ICON_REGISTRY[iconName] ? iconName : FALLBACK_ICON_NAME;
}

export default function EntryRow({ entry, onDelete, onEdit, onToggle }) {
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(entry.text);
  const [selectedIconName, setSelectedIconName] = useState(() => normalizeSelectedIconName(entry.icon));
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const currentDx = useRef(0);
  const resolvedIconName = normalizeSelectedIconName(entry.icon);
  const EntryIcon = ICON_REGISTRY[resolvedIconName] ?? FALLBACK_ICON;
  const PreviewIcon = selectedIconName ? ICON_REGISTRY[selectedIconName] : FALLBACK_ICON;

  useEffect(() => {
    if (!editMode) {
      setEditText(entry.text);
      setSelectedIconName(normalizeSelectedIconName(entry.icon));
      setShowFullPicker(false);
    }
  }, [editMode, entry.icon, entry.text]);

  function cancelEdit() {
    setEditMode(false);
    setEditText(entry.text);
    setSelectedIconName(normalizeSelectedIconName(entry.icon));
    setShowFullPicker(false);
  }

  function submitEdit() {
    const trimmed = editText.trim();

    if (!trimmed) {
      return;
    }

    onEdit?.(trimmed, selectedIconName);
    setEditMode(false);
    setEditText(trimmed);
    setShowFullPicker(false);
  }

  function handleTouchStart(event) {
    if (editMode) {
      return;
    }

    startX.current = event.touches[0].clientX;
    currentDx.current = 0;
    setSwiping(true);
  }

  function handleTouchMove(event) {
    if (editMode) {
      return;
    }

    currentDx.current = event.touches[0].clientX - startX.current;

    if (currentDx.current < 0) {
      setSwipeX(Math.max(currentDx.current, -100));
    }
  }

  function handleTouchEnd() {
    if (editMode) {
      return;
    }

    setSwiping(false);

    if (currentDx.current < -80) {
      setSwipeX(0);
      onDelete?.();
    } else {
      setSwipeX(0);
    }

    currentDx.current = 0;
  }

  return (
    <>
      <div className="entry-row-wrapper">
        <div aria-hidden="true" className="entry-delete-zone">
          <Icon color="var(--color-error)" name="trash" size={20} />
        </div>

        {editMode ? (
          <div className="entry-row entry-row-edit">
            <div className="entry-row-edit-icon-stack">
              <div aria-live="polite" className="add-item-preview entry-row-edit-preview" data-testid={`entry-edit-preview-${entry.id}`}>
                <PreviewIcon
                  aria-hidden="true"
                  className="add-item-preview-svg"
                  data-icon-name={selectedIconName ?? FALLBACK_ICON_NAME}
                  size={28}
                  stroke={1.6}
                />
              </div>

              <div className="add-item-icon-picker entry-row-icon-picker" role="group" aria-label="Entry icons">
                {ICON_REGISTRY_KEYS.map((iconName) => {
                  const PickerIcon = ICON_REGISTRY[iconName];

                  return (
                    <button
                      key={iconName}
                      aria-label={`Choose ${iconName}`}
                      className={`add-item-icon-picker-btn ${
                        selectedIconName === iconName ? "add-item-icon-picker-btn--selected" : ""
                      }`}
                      type="button"
                      onClick={() => setSelectedIconName(iconName)}
                    >
                      <PickerIcon aria-hidden="true" size={20} stroke={1.6} />
                    </button>
                  );
                })}
              </div>

              <button className="eg-btn-ghost add-item-more-btn" type="button" onClick={() => setShowFullPicker(true)}>
                Mehr anzeigen
              </button>
            </div>

            <div className="eg-field">
              <label className="visually-hidden" htmlFor={`entry-edit-${entry.id}`}>
                {`Edit ${entry.text}`}
              </label>
              <input
                id={`entry-edit-${entry.id}`}
                autoFocus
                className="eg-input"
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitEdit();
                  }

                  if (event.key === "Escape") {
                    cancelEdit();
                  }
                }}
              />
            </div>
            <div className="button-row entry-row-edit-actions">
              <button className="eg-btn-ghost" type="button" onClick={cancelEdit}>
                Cancel edit
              </button>
              <button className="eg-btn-secondary" type="button" onClick={submitEdit}>
                Save item
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`entry-row ${entry.status === "done" ? "entry-row-done" : ""}`}
            data-testid={`entry-row-${entry.id}`}
            style={{
              transform: `translateX(${swipeX}px)`,
              transition: swiping ? "none" : "transform 0.25s var(--ease-out)"
            }}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onTouchStart={handleTouchStart}
          >
            <button
              aria-label={entry.status === "done" ? `Mark ${entry.text} open` : `Mark ${entry.text} done`}
              className="eg-icon-btn entry-icon-btn"
              type="button"
              onClick={() => onToggle?.()}
            >
              <Icon
                color={entry.status === "done" ? "var(--color-success)" : "var(--text-disabled)"}
                name="checkCircle"
                size={22}
              />
            </button>

            <EntryIcon
              aria-hidden="true"
              className={`entry-icon ${entry.status === "done" ? "entry-row-done" : ""}`}
              data-icon-name={resolvedIconName ?? FALLBACK_ICON_NAME}
              data-testid={`entry-row-icon-${entry.id}`}
              size={22}
              stroke={1.5}
            />

            <div className="entry-row-copy">
              <p className={`entry-row-text ${entry.status === "done" ? "entry-row-text-done" : ""}`}>{entry.text}</p>
              {entry.is_pending_sync ? <span className="eg-chip-queued entry-row-chip">Queued</span> : null}
            </div>

            <button
              aria-label={`Edit ${entry.text}`}
              className="eg-icon-btn entry-icon-btn"
              type="button"
              onClick={() => {
                setEditMode(true);
                setEditText(entry.text);
                setSelectedIconName(normalizeSelectedIconName(entry.icon));
                setShowFullPicker(false);
              }}
            >
              <Icon color="var(--text-secondary)" name="edit" size={18} />
            </button>
          </div>
        )}
      </div>

      <IconPickerSheet
        open={showFullPicker}
        selectedIconName={selectedIconName}
        onClose={() => setShowFullPicker(false)}
        onSelect={setSelectedIconName}
      />
    </>
  );
}
