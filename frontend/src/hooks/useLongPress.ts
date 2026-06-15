import { useEffect, useRef, useState } from "react";
import type { MouseEvent, TouchEvent } from "react";

interface LongPressHandlers {
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (event: TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onTouchMove: (event: TouchEvent) => void;
  onClick: (event: MouseEvent) => void;
}

interface LongPressResult {
  pressing: boolean;
  longPressHandlers: LongPressHandlers;
}

export function useLongPress(onLongPress: (() => void) | undefined, ms = 500): LongPressResult {
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  const scrollBlockedRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);
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
    scrollBlockedRef.current = false;
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
    touchStartYRef.current = null;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = null;
  }

  function startTouch(event: TouchEvent): void {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
    start();
  }

  function handleTouchMove(event: TouchEvent): void {
    if (touchStartYRef.current === null) {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? touchStartYRef.current;
    if (Math.abs(currentY - touchStartYRef.current) >= 8) {
      scrollBlockedRef.current = true;
      cancel();
    }
  }

  function handleClick(event: MouseEvent): void {
    if (longPressedRef.current || scrollBlockedRef.current) {
      event.preventDefault();
      event.stopPropagation();
      longPressedRef.current = false;
      scrollBlockedRef.current = false;
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
      onTouchMove: handleTouchMove,
      onTouchStart: startTouch,
      onClick: handleClick
    }
  };
}
