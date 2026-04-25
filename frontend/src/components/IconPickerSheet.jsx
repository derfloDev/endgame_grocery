import { useEffect, useState } from "react";
import { ICON_REGISTRY, ICON_REGISTRY_KEYS } from "../data/iconRegistry";
import { BottomSheet } from "./ui";

function normalizeSearchTerm(value) {
  return value.trim().toLowerCase();
}

export default function IconPickerSheet({ open, selectedIconName, onClose, onSelect }) {
  const [searchText, setSearchText] = useState("");
  const normalizedSearchText = normalizeSearchTerm(searchText);

  useEffect(() => {
    if (!open) {
      setSearchText("");
    }
  }, [open]);

  const visibleIconNames = ICON_REGISTRY_KEYS.filter((iconName) =>
    iconName.toLowerCase().includes(normalizedSearchText)
  );

  return (
    <BottomSheet open={open} title="Choose Icon" onClose={onClose}>
      <div className="icon-picker-sheet">
        <label className="visually-hidden" htmlFor="icon-picker-search">
          Search icons
        </label>
        <input
          id="icon-picker-search"
          className="eg-input icon-picker-search"
          placeholder="Search icons"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />

        <div className="icon-picker-grid">
          {visibleIconNames.map((iconName) => {
            const PickerIcon = ICON_REGISTRY[iconName];

            return (
              <button
                key={iconName}
                aria-label={`Select ${iconName}`}
                className={`icon-picker-btn ${selectedIconName === iconName ? "icon-picker-btn--selected" : ""}`}
                type="button"
                onClick={() => {
                  onSelect?.(iconName);
                  onClose?.();
                }}
              >
                <PickerIcon aria-hidden="true" size={24} stroke={1.6} />
                <span className="icon-picker-btn-label">{iconName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}
