import { FALLBACK_ICON_NAME, ICON_REGISTRY, resolveIconName } from "../data/iconRegistry";

export default function AutocompleteSuggestions({ suggestions, onSelect }) {
  if (!suggestions.length) {
    return null;
  }

  return (
    <div className="autocomplete-suggestions" role="listbox" aria-label="Autocomplete suggestions">
      {suggestions.map((suggestion, index) => {
        const resolvedIconName = resolveIconName(suggestion.icon) ?? FALLBACK_ICON_NAME;
        const SuggestionIcon = ICON_REGISTRY[resolvedIconName];
        const key = `${suggestion.text}-${suggestion.icon ?? "none"}-${index}`;

        return (
          <button
            key={key}
            aria-label={suggestion.text}
            className="autocomplete-chip"
            role="option"
            type="button"
            onClick={() => onSelect?.(suggestion.text, suggestion.icon ?? null)}
          >
            <SuggestionIcon aria-hidden="true" size={18} stroke={1.6} />
            <span>{suggestion.text}</span>
          </button>
        );
      })}
    </div>
  );
}
