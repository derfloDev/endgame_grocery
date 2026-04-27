import { useEffect, useRef, useState } from "react";
import { fetchSuggestions } from "../api/suggestions";

const AUTOCOMPLETE_DEBOUNCE_MS = 300;

function normalizeText(value) {
  return value.trim().toLowerCase();
}

function computeLevenshteinDistance(left, right) {
  if (!left) {
    return right.length;
  }

  if (!right) {
    return left.length;
  }

  let previousRow = Array.from({ length: right.length + 1 }, (_value, index) => index);
  let currentRow = new Array(right.length + 1);

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    currentRow[0] = leftIndex + 1;

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;

      currentRow[rightIndex + 1] = Math.min(
        currentRow[rightIndex] + 1,
        previousRow[rightIndex + 1] + 1,
        previousRow[rightIndex] + substitutionCost
      );
    }

    [previousRow, currentRow] = [currentRow, previousRow];
  }

  return previousRow[right.length];
}

function fuzzyMatch(query, text) {
  const normalizedQuery = normalizeText(query);
  const normalizedText = normalizeText(text);

  if (!normalizedQuery || !normalizedText) {
    return false;
  }

  if (normalizedText.includes(normalizedQuery)) {
    return true;
  }

  const maxDistance = Math.floor(normalizedQuery.length / 4) + 1;

  return computeLevenshteinDistance(normalizedQuery, normalizedText) <= maxDistance;
}

function filterOfflineSuggestions(query, suggestions) {
  return [...suggestions]
    .filter((suggestion) => fuzzyMatch(query, suggestion.text))
    .sort((left, right) => (right.useCount ?? 0) - (left.useCount ?? 0))
    .slice(0, 5);
}

export function useAutocomplete(listId, inputText, token) {
  const normalizedText = inputText.trim();
  const requestSequenceRef = useRef(0);
  const [state, setState] = useState({
    suggestions: [],
    loading: false
  });

  useEffect(() => {
    requestSequenceRef.current += 1;
    const requestSequence = requestSequenceRef.current;

    if (!listId || !token || normalizedText.length < 2) {
      setState({
        suggestions: [],
        loading: false
      });
      return;
    }

    setState((currentState) => ({
      suggestions: currentState.suggestions,
      loading: true
    }));

    const timeoutId = window.setTimeout(() => {
      void fetchSuggestions(listId, token, normalizedText)
        .then((result) => {
          if (requestSequenceRef.current !== requestSequence) {
            return;
          }

          const suggestions = Array.isArray(result?.suggestions) ? result.suggestions : [];

          setState({
            suggestions: result?.offline ? filterOfflineSuggestions(normalizedText, suggestions) : suggestions,
            loading: false
          });
        })
        .catch(() => {
          if (requestSequenceRef.current !== requestSequence) {
            return;
          }

          setState({
            suggestions: [],
            loading: false
          });
        });
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [listId, normalizedText, token]);

  return state;
}
