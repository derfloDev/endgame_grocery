import { useEffect, useRef, useState } from "react";
import { EXACT_MATCH_MAP } from "../data/iconDatabase";
import { requestIconMatch } from "../workers/iconWorkerClient";

const WORKER_DEBOUNCE_MS = 300;

function normalizeInputText(inputText) {
  return inputText.trim().toLowerCase();
}

function getExactOrPrefixIcon(normalizedText) {
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

  return null;
}

export function useIconSuggestion(inputText) {
  const normalizedText = normalizeInputText(inputText);
  const exactIcon = getExactOrPrefixIcon(normalizedText);
  const requestSequenceRef = useRef(0);
  const [asyncState, setAsyncState] = useState({
    icon: null,
    loading: false
  });

  useEffect(() => {
    requestSequenceRef.current += 1;
    const requestSequence = requestSequenceRef.current;

    if (!normalizedText || exactIcon) {
      setAsyncState({
        icon: null,
        loading: false
      });
      return;
    }

    setAsyncState({
      icon: null,
      loading: true
    });

    const timeoutId = window.setTimeout(() => {
      void requestIconMatch(inputText.trim())
        .then((result) => {
          if (requestSequenceRef.current !== requestSequence) {
            return;
          }

          setAsyncState({
            icon: result?.icon ?? null,
            loading: false
          });
        })
        .catch(() => {
          if (requestSequenceRef.current !== requestSequence) {
            return;
          }

          setAsyncState({
            icon: null,
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
      icon: null,
      loading: false
    };
  }

  if (exactIcon) {
    return {
      icon: exactIcon,
      loading: false
    };
  }

  return asyncState;
}
