/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import {
  RESYNC_DEDUPE_WINDOW_MS,
  SSE_HEARTBEAT_TIMEOUT_MS,
  SSE_RECONNECT_BASE_DELAY_MS,
  SSE_RECONNECT_JITTER_RATIO,
  SSE_RECONNECT_MAX_DELAY_MS
} from "../api/connectionTimings";
import { reportStreamState } from "../api/connectivity";

export type SseEventType =
  | "entry:created"
  | "entry:updated"
  | "entry:deleted"
  | "history:updated"
  | "list:updated"
  | "list:deleted"
  | "member:added"
  | "member:removed";
export type SseHandler = (data: Record<string, unknown>) => void;

interface EventSourceContextValue {
  addEventListener: (type: SseEventType, handler: SseHandler) => () => void;
  connectionState: "connecting" | "open" | "closed";
  resyncVersion: number;
}

interface EventSourceTimings {
  SSE_RECONNECT_BASE_DELAY_MS: number;
  SSE_RECONNECT_MAX_DELAY_MS: number;
  SSE_RECONNECT_JITTER_RATIO: number;
  SSE_HEARTBEAT_TIMEOUT_MS: number;
  RESYNC_DEDUPE_WINDOW_MS: number;
}

interface EventSourceProviderProps {
  children: ReactNode;
  timings?: Partial<EventSourceTimings>;
}

const EVENT_TYPES: SseEventType[] = [
  "entry:created",
  "entry:updated",
  "entry:deleted",
  "history:updated",
  "list:updated",
  "list:deleted",
  "member:added",
  "member:removed"
];
const EventSourceContext = createContext<EventSourceContextValue | null>(null);

export function EventSourceProvider({ children, timings }: EventSourceProviderProps): ReactElement {
  const { token } = useAuth();
  const baseDelay = timings?.SSE_RECONNECT_BASE_DELAY_MS ?? SSE_RECONNECT_BASE_DELAY_MS;
  const maxDelay = timings?.SSE_RECONNECT_MAX_DELAY_MS ?? SSE_RECONNECT_MAX_DELAY_MS;
  const jitterRatio = timings?.SSE_RECONNECT_JITTER_RATIO ?? SSE_RECONNECT_JITTER_RATIO;
  const heartbeatTimeout = timings?.SSE_HEARTBEAT_TIMEOUT_MS ?? SSE_HEARTBEAT_TIMEOUT_MS;
  const resyncDedupeWindow = timings?.RESYNC_DEDUPE_WINDOW_MS ?? RESYNC_DEDUPE_WINDOW_MS;
  const [connectionState, setConnectionState] = useState<EventSourceContextValue["connectionState"]>("closed");
  const [resyncVersion, setResyncVersion] = useState(0);
  const listenersRef = useRef(new Map<SseEventType, Set<SseHandler>>());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const lastTrafficRef = useRef(0);
  const addEventListener = useCallback((type: SseEventType, handler: SseHandler) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }

    listenersRef.current.get(type)?.add(handler);
    return () => {
      const handlers = listenersRef.current.get(type);
      handlers?.delete(handler);
      if (handlers?.size === 0) {
        listenersRef.current.delete(type);
      }
    };
  }, []);
  const contextValue = useMemo(
    () => ({ addEventListener, connectionState, resyncVersion }),
    [addEventListener, connectionState, resyncVersion]
  );

  useEffect(() => {
    setResyncVersion(0);
    if (!token || typeof window.EventSource !== "function") {
      setConnectionState("closed");
      return undefined;
    }

    let disposed = false;
    let hasOpened = false;
    let lostSinceOpen = false;
    let wasHidden = document.visibilityState === "hidden";
    let lastResyncAt = -Infinity;
    let removeSourceListeners: (() => void) | undefined;
    const url = `/api/events?token=${encodeURIComponent(token)}`;
    attemptRef.current = 0;

    function requestResync() {
      // Pages load on mount, so the first open is excluded by the caller. Collapse the
      // reconnect and foreground notifications that often arrive together after mobile sleep.
      const now = Date.now();
      if (now - lastResyncAt < resyncDedupeWindow) {
        return;
      }
      lastResyncAt = now;
      setResyncVersion((version) => version + 1);
    }

    function clearReconnectTimer() {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    function closeSource() {
      if (watchdogTimerRef.current !== null) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      removeSourceListeners?.();
      removeSourceListeners = undefined;
      const source = eventSourceRef.current;
      eventSourceRef.current = null;
      source?.close();
    }

    function scheduleReconnect() {
      if (disposed || reconnectTimerRef.current !== null) {
        return;
      }
      closeSource();
      lostSinceOpen = true;
      reportStreamState("lost");
      setConnectionState("closed");
      // A quick first retry recovers mobile drops; the cap and jitter limit outage retry storms.
      const delay = Math.min(baseDelay * 2 ** attemptRef.current, maxDelay);
      const jitteredDelay = Math.min(maxDelay, delay * (1 + (Math.random() * 2 - 1) * jitterRatio));
      attemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, jitteredDelay);
    }

    function armWatchdog() {
      lastTrafficRef.current = Date.now();
      if (watchdogTimerRef.current !== null) {
        clearTimeout(watchdogTimerRef.current);
      }
      // Mobile networks can leave a stream OPEN without delivering traffic or an error.
      // The 45 s default allows 1.5 of the server's 30 s heartbeat intervals.
      watchdogTimerRef.current = setTimeout(scheduleReconnect, heartbeatTimeout);
    }

    function connect() {
      if (disposed) {
        return;
      }
      clearReconnectTimer();
      closeSource();
      setConnectionState("connecting");
      const source = new window.EventSource(url);
      eventSourceRef.current = source;
      const isCurrent = () => !disposed && eventSourceRef.current === source;
      const eventListeners: Array<[string, (event: MessageEvent<string>) => void]> = EVENT_TYPES.map((type) => {
        const listener = (event: MessageEvent<string>) => {
          if (!isCurrent()) {
            return;
          }
          armWatchdog();
          const data = parseEventData(event.data);
          for (const handler of listenersRef.current.get(type) ?? []) {
            handler(data);
          }
        };
        return [type, listener];
      });
      const onTraffic = () => {
        if (isCurrent()) {
          armWatchdog();
        }
      };
      eventListeners.push(["ping", onTraffic], ["message", onTraffic]);
      for (const [type, listener] of eventListeners) {
        source.addEventListener(type, listener);
      }
      source.onopen = () => {
        if (!isCurrent()) {
          return;
        }
        attemptRef.current = 0;
        reportStreamState("open");
        setConnectionState("open");
        armWatchdog();
        if (hasOpened && lostSinceOpen) {
          requestResync();
        }
        hasOpened = true;
        lostSinceOpen = false;
      };
      source.onerror = () => {
        if (!isCurrent()) {
          return;
        }
        lostSinceOpen = true;
        reportStreamState("lost");
        if (source.readyState === window.EventSource.CLOSED) {
          scheduleReconnect();
        } else {
          // Preserve native EventSource retry until the watchdog detects sustained silence.
          setConnectionState("connecting");
        }
      };
      removeSourceListeners = () => {
        source.onopen = null;
        source.onerror = null;
        for (const [type, listener] of eventListeners) {
          source.removeEventListener(type, listener);
        }
      };
      armWatchdog();
    }

    function reconnectIfUnhealthy() {
      // Background timers may be throttled, so also check elapsed time on foreground return.
      const healthy = eventSourceRef.current?.readyState === window.EventSource.OPEN
        && Date.now() - lastTrafficRef.current < heartbeatTimeout;
      if (!healthy) {
        lostSinceOpen = true;
        reportStreamState("lost");
        connect();
      }
      return healthy;
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        const healthy = reconnectIfUnhealthy();
        if (wasHidden && healthy) {
          requestResync();
        }
        wasHidden = false;
      } else if (document.visibilityState === "hidden") {
        wasHidden = true;
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", reconnectIfUnhealthy);
    connect();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", reconnectIfUnhealthy);
      clearReconnectTimer();
      closeSource();
      reportStreamState("lost");
    };
  }, [token, baseDelay, maxDelay, jitterRatio, heartbeatTimeout, resyncDedupeWindow]);

  return (
    <EventSourceContext.Provider value={contextValue}>
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
