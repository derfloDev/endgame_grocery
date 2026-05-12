import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

interface LongPressHandlers {
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onClick: (event: MouseEvent) => void;
}

interface LongPressResult {
  pressing: boolean;
  longPressHandlers: LongPressHandlers;
}

export function useLongPress(onLongPress: (() => void) | undefined, ms = 500): LongPressResult {
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  const [pressing, setPressing] = useState(false);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    []
  );

  function start(): void {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    longPressedRef.current = false;
    setPressing(true);
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      timerRef.current = null;
      setPressing(false);
      onLongPress?.();
    }, ms);
  }

  function cancel(): void {
    setPressing(false);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = null;
  }

  function handleClick(event: MouseEvent): void {
    if (longPressedRef.current) {
      event.preventDefault();
      event.stopPropagation();
      longPressedRef.current = false;
    }
  }

  return {
    pressing,
    longPressHandlers: {
      onMouseDown: start,
      onMouseLeave: cancel,
      onMouseUp: cancel,
      onTouchCancel: cancel,
      onTouchEnd: cancel,
      onTouchStart: start,
      onClick: handleClick
    }
  };
}
