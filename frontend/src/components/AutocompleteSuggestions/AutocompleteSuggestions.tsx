import { useTranslation } from "react-i18next";
import { FALLBACK_ICON_NAME, ICON_REGISTRY, resolveIconName } from "../../data/iconRegistry";
import type { Suggestion } from "../../types";
import type { ReactElement } from "react";
import styles from "./AutocompleteSuggestions.module.css";

interface AutocompleteSuggestionsProps {
  suggestions: Suggestion[];
  onSelect: (text: string, iconName: string | null) => void;
}

export default function AutocompleteSuggestions({
  suggestions,
  onSelect
}: AutocompleteSuggestionsProps): ReactElement | null {
  const { t } = useTranslation();

  if (!suggestions.length) {
    return null;
  }

  return (
    <div className={styles["autocomplete-suggestions"]} role="listbox" aria-label={t("autocomplete.label")}>
      {suggestions.map((suggestion, index) => {
        const resolvedIconName = resolveIconName(suggestion.icon) ?? FALLBACK_ICON_NAME;
        const SuggestionIcon = ICON_REGISTRY[resolvedIconName];
        const key = `${suggestion.text}-${suggestion.icon ?? "none"}-${index}`;

        return (
          <button
            key={key}
            aria-label={suggestion.text}
            className={styles["autocomplete-chip"]}
            role="option"
            type="button"
            onClick={() => onSelect(suggestion.text, suggestion.icon ?? null)}
          >
            <SuggestionIcon aria-hidden="true" size={18} stroke={1.6} />
            <span>{suggestion.text}</span>
          </button>
        );
      })}
    </div>
  );
}
