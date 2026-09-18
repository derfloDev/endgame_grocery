type StreamState = "open" | "lost";
type Listener = () => void;

// Shared without a React provider so the stream and offline queue can render independently.
let streamState: StreamState = "lost";
let isOnline: boolean | null = null;
let stale = true;
const listeners = new Set<Listener>();

export function reportStreamState(nextState: StreamState): void {
  const nextStale = nextState === "lost";
  if (streamState === nextState && stale === nextStale) {
    return;
  }

  streamState = nextState;
  stale = nextStale;
  if (nextState === "open") {
    isOnline = true;
  }
  // Losing SSE invalidates freshness, but does not prove that HTTP requests will fail.
  // Reachability probing and the offline queue will consume this state in T-003.
  for (const listener of listeners) {
    listener();
  }
}

/** Last confirmed reachability; null means it has not been established yet. */
export function getIsOnline(): boolean | null {
  return isOnline;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetConnectivityForTests(): void {
  streamState = "lost";
  isOnline = null;
  stale = true;
  listeners.clear();
}
