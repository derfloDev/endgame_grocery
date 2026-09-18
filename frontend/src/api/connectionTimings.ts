// Fast first retry, bounded battery use and jitter for clients waking after the same outage.
export const SSE_RECONNECT_BASE_DELAY_MS = 1_000;
export const SSE_RECONNECT_MAX_DELAY_MS = 30_000;
export const SSE_RECONNECT_JITTER_RATIO = 0.3;
// Allow 1.5 server heartbeat intervals before replacing a silent mobile connection.
export const SSE_HEARTBEAT_TIMEOUT_MS = 45_000;
// Bound stalled mobile requests and keep reachability checks faster than regular requests.
export const REQUEST_TIMEOUT_MS = 10_000;
export const REACHABILITY_PROBE_TIMEOUT_MS = 5_000;
export const REACHABILITY_PROBE_MIN_INTERVAL_MS = 5_000;
// Foreground and reconnect events often arrive together after a mobile wake-up.
export const RESYNC_DEDUPE_WINDOW_MS = 2_000;
export const QUEUE_RETRY_BASE_DELAY_MS = 1_000;
export const QUEUE_RETRY_MAX_DELAY_MS = 60_000;
export const QUEUE_DRAIN_STALL_TIMEOUT_MS = 30_000;

/** A cancellable request deadline that also works where AbortSignal.timeout is unavailable. */
export function createTimeoutSignal(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}
