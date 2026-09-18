import { createTimeoutSignal, REACHABILITY_PROBE_MIN_INTERVAL_MS, REACHABILITY_PROBE_TIMEOUT_MS } from "./connectionTimings";

type StreamState = "open" | "lost";
type Listener = () => void;
export interface ReachabilityTimings {
  REACHABILITY_PROBE_TIMEOUT_MS?: number;
  REACHABILITY_PROBE_MIN_INTERVAL_MS?: number;
}

// Shared without a React provider so the stream and offline queue can render independently.
let streamState: StreamState = "lost";
let isOnline: boolean | null = null;
let stale = true;
let lastCheckedAt = -Infinity;
let lastProbeAt = -Infinity;
let browserHint: boolean | undefined;
let inFlight: { promise: Promise<boolean>; cancel: (online: boolean) => void } | undefined;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

function confirmOnline(): void {
  const changed = isOnline !== true || stale;
  isOnline = true;
  stale = false;
  lastCheckedAt = Date.now();
  inFlight?.cancel(true);
  if (changed) notify();
}

export function reportStreamState(nextState: StreamState): void {
  if (nextState === "open") {
    streamState = nextState;
    confirmOnline();
  } else if (streamState !== nextState || !stale) {
    streamState = nextState;
    // Losing SSE invalidates freshness, but does not prove that HTTP requests will fail.
    stale = true;
    notify();
  }
}

export function reportRequestOutcome(outcome: "ok" | "network-error"): void {
  if (outcome === "ok") confirmOnline();
  else if (!stale) {
    stale = true;
    notify();
  }
}

/** Last confirmed reachability; null means it has not been established yet. */
export function getIsOnline(): boolean | null {
  return isOnline;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function ensureFreshState(timings: ReachabilityTimings = {}): Promise<boolean> {
  // Either browser hint can be wrong. A change invalidates freshness, never reachability itself.
  const nextHint = typeof navigator === "undefined" ? undefined : navigator.onLine;
  if (browserHint !== undefined && browserHint !== nextHint) stale = true;
  browserHint = nextHint;
  const interval = timings.REACHABILITY_PROBE_MIN_INTERVAL_MS ?? REACHABILITY_PROBE_MIN_INTERVAL_MS;
  if (!stale && ((streamState === "open" && isOnline === true) || Date.now() - lastCheckedAt < interval)) {
    return Promise.resolve(isOnline === true);
  }
  return probeReachability(timings);
}

export function probeReachability(timings: ReachabilityTimings = {}): Promise<boolean> {
  if (inFlight) return inFlight.promise;
  const interval = timings.REACHABILITY_PROBE_MIN_INTERVAL_MS ?? REACHABILITY_PROBE_MIN_INTERVAL_MS;
  if ((!stale && streamState === "open" && isOnline === true) || Date.now() - lastProbeAt < interval) {
    return Promise.resolve(isOnline === true);
  }
  lastProbeAt = Date.now();
  const controller = new AbortController();
  const deadline = createTimeoutSignal(timings.REACHABILITY_PROBE_TIMEOUT_MS ?? REACHABILITY_PROBE_TIMEOUT_MS);
  let resolve!: (online: boolean) => void;
  const promise = new Promise<boolean>((done) => { resolve = done; });
  let finished = false;
  function finish(online: boolean, publish: boolean): void {
    if (finished) return;
    finished = true;
    deadline.cancel();
    deadline.signal.removeEventListener("abort", onTimeout);
    if (publish) {
      const changed = isOnline !== online || stale;
      isOnline = online;
      stale = false;
      lastCheckedAt = Date.now();
      if (changed) notify();
    }
    inFlight = undefined;
    resolve(online);
  }
  function onTimeout(): void {
    controller.abort();
    finish(false, true);
  }
  inFlight = { promise, cancel: (online) => { controller.abort(); finish(online, false); } };
  deadline.signal.addEventListener("abort", onTimeout);
  // Settle explicitly on timeout even if a fetch implementation ignores cancellation.
  void fetch("/api/health", { cache: "no-store", signal: controller.signal }).then(
    (response) => finish(response.ok, true),
    () => finish(false, true)
  );
  return promise;
}

export function resetConnectivityForTests(): void {
  listeners.clear();
  inFlight?.cancel(false);
  streamState = "lost";
  isOnline = null;
  stale = true;
  lastCheckedAt = -Infinity;
  lastProbeAt = -Infinity;
  browserHint = undefined;
}
