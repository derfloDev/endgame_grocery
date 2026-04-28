import { FALLBACK_ICON, ICON_REGISTRY } from "../data/iconRegistry";

export default function AutocompleteSuggestions({ suggestions, onSelect }) {
  if (!suggestions.length) {
    return null;
  }

  return (
    <div className="autocomplete-suggestions" role="listbox" aria-label="Autocomplete suggestions">
      {suggestions.map((suggestion, index) => {
        // Always render an icon so rows keep the same visual structure and touch target.
        const SuggestionIcon = (suggestion.icon ? ICON_REGISTRY[suggestion.icon] : null) ?? FALLBACK_ICON;
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
