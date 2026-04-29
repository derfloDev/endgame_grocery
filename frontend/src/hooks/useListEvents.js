import { useEffect } from "react";
import { useEventSource } from "../context/EventSourceContext";

/**
 * Subscribes to a list-scoped SSE event and forwards matching payloads.
 * Pass `null` as `listId` to receive all events of the given type.
 */
export function useListEvents(eventType, listId, handler) {
  const { addEventListener } = useEventSource();

  useEffect(() => {
    return addEventListener(eventType, (data) => {
      if (!listId || data.listId === listId) {
        handler(data);
      }
    });
  }, [addEventListener, eventType, handler, listId]);
}
