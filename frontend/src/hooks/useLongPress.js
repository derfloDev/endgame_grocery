import { useEffect, useRef, useState } from "react";

export function useLongPress(onLongPress, ms = 500) {
  const timerRef = useRef(null);
  const longPressedRef = useRef(false);
  const [pressing, setPressing] = useState(false);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
    },
    []
  );

  function start() {
    clearTimeout(timerRef.current);
    longPressedRef.current = false;
    setPressing(true);
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      timerRef.current = null;
      setPressing(false);
      onLongPress?.();
    }, ms);
  }

  function cancel() {
    setPressing(false);
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function handleClick(event) {
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
