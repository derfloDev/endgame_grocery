import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FocusEvent, FormEvent, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { formatIconName, ICON_REGISTRY, ICON_REGISTRY_KEYS, resolveIconName } from "../../data/iconRegistry";
import { useAutocomplete } from "../../hooks/useAutocomplete";
import { useIconSuggestion } from "../../hooks/useIconSuggestion";
import AutocompleteSuggestions from "../AutocompleteSuggestions/AutocompleteSuggestions";
import { BottomSheet } from "../ui";
import styles from "./AddItemSheet.module.css";

interface AddItemSheetProps {
  initialDetails?: string;
  initialIconName?: string | null;
  initialText?: string;
  listId?: string;
  mode?: "add" | "edit";
  open: boolean;
  onAdd?: (text: string, iconName: string | null, details: string) => Promise<boolean | void> | boolean | void;
  onClose: () => void;
}

function normalizeSearchTerm(value: string): string {
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
}: AddItemSheetProps): ReactElement {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [text, setText] = useState(initialText);
  const [details, setDetails] = useState(initialDetails);
  const [selectedIconName, setSelectedIconName] = useState(resolveIconName(initialIconName));
  const [showIconBrowser, setShowIconBrowser] = useState(false);
  const [iconBrowserSearchText, setIconBrowserSearchText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputAnchorRef = useRef<HTMLDivElement | null>(null);
  const iconSearchRef = useRef<HTMLInputElement | null>(null);
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
  const sheetTitle = isEditMode ? t("item.editTitle") : t("item.addTitle");
  const inputLabel = isEditMode ? t("item.editLabel") : t("item.addLabel");
  const submitLabel = isEditMode ? t("item.saveItem") : t("item.addTitle");
  const iconBrowserToggleLabel = showIconBrowser ? t("item.showLess") : t("item.showMore");
  const getClassName = (...classNames: Array<string | false | undefined>) => classNames.filter(Boolean).join(" ");

  useEffect(() => {
    setText(initialText);
    setDetails(initialDetails);
    setSelectedIconName(resolveIconName(initialIconName));
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

    function handlePointerOutside(event: MouseEvent | TouchEvent): void {
      const target = event.target;

      if (inputAnchorRef.current && target instanceof Node && !inputAnchorRef.current.contains(target)) {
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

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const value = event.target.value;

    setText(value);
    setShowSuggestions(value.trim().length >= 2);
  }

  function handleInputFocus(event: FocusEvent<HTMLInputElement>): void {
    event.target.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest"
    });

    if (!isEditMode && text.trim().length >= 2) {
      setShowSuggestions(true);
    }
  }

  async function handleQuickAdd(suggestedText: string, suggestedIconName: string | null): Promise<void> {
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

  async function handleSubmit(event?: FormEvent<HTMLFormElement>): Promise<void> {
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
    <BottomSheet browserOpen={showIconBrowser} open={open} title={sheetTitle} onClose={onClose}>
      <form
        className={getClassName(styles["add-item-form"], showIconBrowser && styles["add-item-form--browser-open"])}
        onSubmit={handleSubmit}
      >
        <div className="eg-field">
          <label htmlFor={textInputId}>{inputLabel}</label>
          <div className="eg-input-wrap">
            <div className="eg-input-anchor" ref={inputAnchorRef}>
              <input
                id={textInputId}
                autoComplete="off"
                autoFocus={!showIconBrowser}
                className="eg-input"
                placeholder={t("item.addPlaceholder")}
                value={text}
                onFocus={handleInputFocus}
                onChange={handleInputChange}
              />
              {showSuggestions && !isEditMode ? (
                <AutocompleteSuggestions suggestions={suggestions} onSelect={handleQuickAdd} />
              ) : null}
            </div>
            {loading ? (
              <div
                aria-live="polite"
                className={getClassName(styles["add-item-preview"], styles["add-item-preview-loading"])}
              >
                <span aria-label={t("item.loadingIcon")} className={styles["add-item-preview-spinner"]} />
              </div>
            ) : PreviewIcon ? (
              <div aria-live="polite" className={styles["add-item-preview"]} data-testid="add-item-icon-preview">
                <PreviewIcon aria-hidden="true" className={styles["add-item-preview-svg"]} size={28} stroke={1.6} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="eg-field">
          <label htmlFor={detailsInputId}>{t("item.detailsLabel")}</label>
          <input
            id={detailsInputId}
            className="eg-input"
            placeholder={t("item.detailsPlaceholder")}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
        </div>

        {suggestedIconNames.length > 0 ? (
          <div className={styles["add-item-icon-picker"]} role="group" aria-label={t("item.suggestedIcons")}>
            {suggestedIconNames.map((suggestedIconName) => {
              const SuggestedIcon = ICON_REGISTRY[suggestedIconName];

              return (
                <button
                  key={suggestedIconName}
                  aria-label={t("item.chooseSpecificIcon", { name: formatIconName(suggestedIconName) })}
                  className={getClassName(
                    styles["add-item-icon-picker-btn"],
                    selectedIconName === suggestedIconName && styles["add-item-icon-picker-btn--selected"]
                  )}
                  type="button"
                  onClick={() => setSelectedIconName(suggestedIconName)}
                >
                  <SuggestedIcon aria-hidden="true" size={20} stroke={1.6} />
                </button>
              );
            })}
          </div>
        ) : null}

        <div
          className={getClassName(
            styles["add-item-disclosure"],
            showIconBrowser && styles["add-item-disclosure--open"],
            showIconBrowser && styles["add-item-disclosure--browser-open"]
          )}
        >
          <button
            className={styles["add-item-more-btn"]}
            type="button"
            onClick={() => setShowIconBrowser((currentValue) => !currentValue)}
          >
            {iconBrowserToggleLabel}
          </button>

          <div
            aria-hidden={!showIconBrowser}
            className={getClassName(
              styles["add-item-icon-browser"],
              showIconBrowser && styles["add-item-icon-browser--open"],
              showIconBrowser && styles["add-item-icon-browser--browser-open"]
            )}
            data-testid="add-item-icon-browser"
            inert={!showIconBrowser || undefined}
          >
            <div
              className={getClassName(
                styles["add-item-icon-browser-inner"],
                showIconBrowser && styles["add-item-icon-browser-inner--browser-open"]
              )}
              data-testid="add-item-icon-browser-inner"
            >
              <label className="visually-hidden" htmlFor={iconSearchInputId}>
                {t("item.searchIcons")}
              </label>
              <input
                ref={iconSearchRef}
                id={iconSearchInputId}
                className="eg-input"
                placeholder={t("item.searchIcons")}
                value={iconBrowserSearchText}
                onChange={(event) => setIconBrowserSearchText(event.target.value)}
              />

              <div
                className={getClassName(
                  styles["add-item-icon-browser-grid"],
                  showIconBrowser && styles["add-item-icon-browser-grid--browser-open"]
                )}
                data-testid="add-item-icon-browser-grid"
              >
                {visibleIconNames.map((browserIconName) => {
                  const BrowserIcon = ICON_REGISTRY[browserIconName];

                  return (
                    <button
                      key={browserIconName}
                      aria-label={t("item.browseSpecificIcon", { name: formatIconName(browserIconName) })}
                      className={getClassName(
                        styles["add-item-icon-browser-btn"],
                        selectedIconName === browserIconName && styles["add-item-icon-browser-btn--selected"]
                      )}
                      type="button"
                      onClick={() => {
                        setSelectedIconName(browserIconName);
                        setShowIconBrowser(false);
                        setIconBrowserSearchText("");
                      }}
                    >
                      <BrowserIcon aria-hidden="true" size={22} stroke={1.6} />
                      <span className={styles["icon-picker-btn-label"]}>{formatIconName(browserIconName)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className={`button-row ${styles["add-item-actions"]}`}>
          <button className="eg-btn-ghost" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="eg-btn-primary" disabled={!text.trim()} type="submit">
            {submitLabel}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
