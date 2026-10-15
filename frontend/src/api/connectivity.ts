import { createTimeoutSignal, REACHABILITY_PROBE_MIN_INTERVAL_MS, REACHABILITY_PROBE_TIMEOUT_MS } from "./connectionTimings";
import { detectEdgeGate } from "./edgeGate";
import type { EdgeGateReason } from "./edgeGate";

type StreamState = "open" | "lost";
export type Reachability = "online" | "offline" | "gated";
type ReachabilityReason = EdgeGateReason | "network-error" | "timeout" | `status-${number}`;
type Listener = () => void;
export interface ReachabilityTimings {
  REACHABILITY_PROBE_TIMEOUT_MS?: number;
  REACHABILITY_PROBE_MIN_INTERVAL_MS?: number;
}

// Shared without a React provider so the stream and offline queue can render independently.
// Gated means the network is available but edge access blocks API traffic. Keep queued work
// paused like offline, while exposing a distinct state so the UI can offer access recovery.
let streamState: StreamState = "lost";
let reachability: Reachability | null = null;
let stale = true;
let lastCheckedAt = -Infinity;
let lastProbeAt = -Infinity;
let browserHint: boolean | undefined;
let inFlight: { promise: Promise<boolean>; cancel: (online: boolean) => void } | undefined;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

function publishReachability(next: Reachability, reason?: ReachabilityReason, path = "/api/health"): boolean {
  const changed = reachability !== next || stale;
  if (reachability !== next && next !== "online") {
    // Only the classification reason and pathname are safe evidence: never log request
    // URLs, exception details, tokens, headers or cookies (including query strings).
    console.warn(reason, new URL(path, "https://grocery.example").pathname);
  }
  reachability = next;
  stale = false;
  lastCheckedAt = Date.now();
  return changed;
}

function confirmReachability(next: "online" | "gated", reason?: EdgeGateReason, path?: string): void {
  const changed = publishReachability(next, reason, path);
  inFlight?.cancel(next === "online");
  if (changed) notify();
}

export function reportStreamState(nextState: StreamState): void {
  if (nextState === "open") {
    streamState = nextState;
    confirmReachability("online");
  } else if (streamState !== nextState || !stale) {
    streamState = nextState;
    // Losing SSE invalidates freshness, but does not prove that HTTP requests will fail.
    stale = true;
    notify();
  }
}

export function reportRequestOutcome(outcome: "ok" | "network-error" | "gated", reason?: EdgeGateReason, path?: string): void {
  if (outcome === "ok") confirmReachability("online");
  else if (outcome === "gated") confirmReachability("gated", reason, path);
  else if (!stale) {
    stale = true;
    notify();
  }
}

/** Last confirmed reachability; null means it has not been established yet. */
export function getIsOnline(): boolean | null {
  return reachability === null ? null : reachability === "online";
}

/** Last confirmed state; a gate must not be presented as an offline device. */
export function getReachability(): Reachability | null {
  return reachability;
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
  if (!stale && ((streamState === "open" && reachability === "online") || Date.now() - lastCheckedAt < interval)) {
    return Promise.resolve(reachability === "online");
  }
  return probeReachability(timings);
}

export function probeReachability(timings: ReachabilityTimings = {}): Promise<boolean> {
  if (inFlight) return inFlight.promise;
  const interval = timings.REACHABILITY_PROBE_MIN_INTERVAL_MS ?? REACHABILITY_PROBE_MIN_INTERVAL_MS;
  if ((!stale && streamState === "open" && reachability === "online") || Date.now() - lastProbeAt < interval) {
    return Promise.resolve(reachability === "online");
  }
  lastProbeAt = Date.now();
  const controller = new AbortController();
  const deadline = createTimeoutSignal(timings.REACHABILITY_PROBE_TIMEOUT_MS ?? REACHABILITY_PROBE_TIMEOUT_MS);
  let resolve!: (online: boolean) => void;
  const promise = new Promise<boolean>((done) => { resolve = done; });
  let finished = false;
  function finish(next: Reachability, publish: boolean, reason?: ReachabilityReason): void {
    if (finished) return;
    finished = true;
    deadline.cancel();
    deadline.signal.removeEventListener("abort", onTimeout);
    const changed = publish && publishReachability(next, reason);
    inFlight = undefined;
    resolve(next === "online");
    if (changed) notify();
  }
  function onTimeout(): void {
    controller.abort();
    finish("offline", true, "timeout");
  }
  inFlight = { promise, cancel: (online) => { controller.abort(); finish(online ? "online" : "offline", false); } };
  deadline.signal.addEventListener("abort", onTimeout);
  // Settle explicitly on timeout even if a fetch implementation ignores cancellation.
  void fetch("/api/health", { cache: "no-store", redirect: "manual", signal: controller.signal }).then(
    (response) => {
      const gate = detectEdgeGate(response, { anyAuthStatus: true });
      if (gate) finish("gated", true, gate);
      else finish(response.ok ? "online" : "offline", true, `status-${response.status}`);
    },
    () => finish("offline", true, "network-error")
  );
  return promise;
}

export function resetConnectivityForTests(): void {
  listeners.clear();
  inFlight?.cancel(false);
  streamState = "lost";
  reachability = null;
  stale = true;
  lastCheckedAt = -Infinity;
  lastProbeAt = -Infinity;
  browserHint = undefined;
}
