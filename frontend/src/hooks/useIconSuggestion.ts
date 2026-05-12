import { useEffect, useRef, useState } from "react";
import { EXACT_MATCH_MAP } from "../data/iconDatabase";
import { requestIconMatch } from "../workers/iconWorkerClient";

const WORKER_DEBOUNCE_MS = 300;

interface IconSuggestionResult {
  iconName: string | null;
  topMatches: string[];
  loading: boolean;
}

function normalizeInputText(inputText: string): string {
  return inputText.trim().toLowerCase();
}

function getExactOrPrefixIcon(normalizedText: string): string | null {
  if (!normalizedText) {
    return null;
  }

  if (EXACT_MATCH_MAP[normalizedText]) {
    return EXACT_MATCH_MAP[normalizedText];
  }

  for (const [term, icon] of Object.entries(EXACT_MATCH_MAP)) {
    if (term.startsWith(normalizedText) || normalizedText.startsWith(term)) {
      return icon;
    }
  }

  let bestSubstringIcon: string | null = null;
  let bestSubstringLength = 0;

  for (const [term, icon] of Object.entries(EXACT_MATCH_MAP)) {
    if (term.length >= 4 && normalizedText.includes(term) && term.length > bestSubstringLength) {
      bestSubstringIcon = icon;
      bestSubstringLength = term.length;
    }
  }

  if (bestSubstringIcon) {
    return bestSubstringIcon;
  }

  return null;
}

export function useIconSuggestion(inputText: string): IconSuggestionResult {
  const normalizedText = normalizeInputText(inputText);
  const exactIcon = getExactOrPrefixIcon(normalizedText);
  const requestSequenceRef = useRef(0);
  const [asyncState, setAsyncState] = useState<IconSuggestionResult>({
    iconName: null,
    topMatches: [],
    loading: false
  });

  useEffect(() => {
    requestSequenceRef.current += 1;
    const requestSequence = requestSequenceRef.current;

    if (!normalizedText || exactIcon) {
      setAsyncState({
        iconName: null,
        topMatches: [],
        loading: false
      });
      return;
    }

    setAsyncState({
      iconName: null,
      topMatches: [],
      loading: true
    });

    const timeoutId = window.setTimeout(() => {
      void requestIconMatch(inputText.trim())
        .then((result) => {
          if (requestSequenceRef.current !== requestSequence) {
            return;
          }

          setAsyncState({
            iconName: result?.iconName ?? null,
            topMatches: (result?.topMatches ?? []).slice(0, 5).map((match) => match.iconName),
            loading: false
          });
        })
        .catch(() => {
          if (requestSequenceRef.current !== requestSequence) {
            return;
          }

          setAsyncState({
            iconName: null,
            topMatches: [],
            loading: false
          });
        });
    }, WORKER_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [exactIcon, inputText, normalizedText]);

  if (!normalizedText) {
    return {
      iconName: null,
      topMatches: [],
      loading: false
    };
  }

  if (exactIcon) {
    return {
      iconName: exactIcon,
      topMatches: [],
      loading: false
    };
  }

  return asyncState;
}
