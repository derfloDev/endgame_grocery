/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";

const EVENT_TYPES = [
  "entry:created",
  "entry:updated",
  "entry:deleted",
  "list:updated",
  "list:deleted",
  "member:added",
  "member:removed"
];
const EventSourceContext = createContext(null);

export function EventSourceProvider({ children }) {
  const { token } = useAuth();
  const listenersRef = useRef(new Map());
  const eventSourceRef = useRef(null);
  const contextValueRef = useRef({
    addEventListener(type, handler) {
      if (!listenersRef.current.has(type)) {
        listenersRef.current.set(type, new Set());
      }

      listenersRef.current.get(type).add(handler);

      return () => {
        const handlers = listenersRef.current.get(type);

        if (!handlers) {
          return;
        }

        handlers.delete(handler);

        if (handlers.size === 0) {
          listenersRef.current.delete(type);
        }
      };
    }
  });

  useEffect(() => {
    if (!token || typeof window.EventSource !== "function") {
      return undefined;
    }

    const eventSource = new window.EventSource(`/api/events?token=${encodeURIComponent(token)}`);
    const eventListeners = EVENT_TYPES.map((type) => {
      const listener = (event) => {
        const data = parseEventData(event.data);

        for (const handler of listenersRef.current.get(type) ?? []) {
          handler(data);
        }
      };

      eventSource.addEventListener(type, listener);
      return [type, listener];
    });

    eventSourceRef.current = eventSource;

    function cleanup() {
      for (const [type, listener] of eventListeners) {
        eventSource.removeEventListener(type, listener);
      }

      eventSource.close();

      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current = null;
      }
    }

    eventSource.onerror = () => {
      if (eventSource.readyState === window.EventSource.CLOSED) {
        cleanup();
      }
    };

    return cleanup;
  }, [token]);

  return (
    <EventSourceContext.Provider value={contextValueRef.current}>
      {children}
    </EventSourceContext.Provider>
  );
}

export function useEventSource() {
  const context = useContext(EventSourceContext);

  if (!context) {
    throw new Error("useEventSource must be used inside an EventSourceProvider.");
  }

  return context;
}

function parseEventData(rawData) {
  if (!rawData) {
    return {};
  }

  try {
    return JSON.parse(rawData);
  } catch {
    return {};
  }
}
