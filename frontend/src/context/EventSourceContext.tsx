/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { useAuth } from "./AuthContext";

export type SseEventType =
  | "entry:created"
  | "entry:updated"
  | "entry:deleted"
  | "list:updated"
  | "list:deleted"
  | "member:added"
  | "member:removed";
export type SseHandler = (data: Record<string, unknown>) => void;

interface EventSourceContextValue {
  addEventListener: (type: SseEventType, handler: SseHandler) => () => void;
}

interface EventSourceProviderProps {
  children: ReactNode;
}

const EVENT_TYPES: SseEventType[] = [
  "entry:created",
  "entry:updated",
  "entry:deleted",
  "list:updated",
  "list:deleted",
  "member:added",
  "member:removed"
];
const EventSourceContext = createContext<EventSourceContextValue | null>(null);

export function EventSourceProvider({ children }: EventSourceProviderProps): ReactElement {
  const { token } = useAuth();
  const listenersRef = useRef(new Map<SseEventType, Set<SseHandler>>());
  const eventSourceRef = useRef<EventSource | null>(null);
  const contextValueRef = useRef<EventSourceContextValue>({
    addEventListener(type, handler) {
      if (!listenersRef.current.has(type)) {
        listenersRef.current.set(type, new Set());
      }

      listenersRef.current.get(type)?.add(handler);

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
    const eventListeners: Array<[SseEventType, (event: MessageEvent<string>) => void]> = EVENT_TYPES.map((type) => {
      const listener = (event: MessageEvent<string>) => {
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

export function useEventSource(): EventSourceContextValue {
  const context = useContext(EventSourceContext);

  if (!context) {
    throw new Error("useEventSource must be used inside an EventSourceProvider.");
  }

  return context;
}

function parseEventData(rawData: string): Record<string, unknown> {
  if (!rawData) {
    return {};
  }

  try {
    const data = JSON.parse(rawData) as unknown;
    return isRecord(data) ? data : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
