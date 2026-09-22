import { abortable, createTimeoutSignal, REQUEST_TIMEOUT_MS } from "./connectionTimings";
import { probeReachability, reportRequestOutcome } from "./connectivity";

export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError ||
    (error instanceof Error && error.message === "Failed to fetch") ||
    (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError"));
}

/** Bound both headers and body reads, and relay drain cancellation to the actual fetch. */
export async function requestJson<T = unknown>(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
  parentSignal?: AbortSignal
): Promise<{ response: Response; data: T }> {
  const deadline = createTimeoutSignal(timeoutMs);
  parentSignal?.addEventListener("abort", deadline.abort, { once: true });
  try {
    if (parentSignal?.aborted) deadline.abort();
    deadline.signal.throwIfAborted();
    const response = await abortable(fetch(url, { ...init, signal: deadline.signal }), deadline.signal);
    reportRequestOutcome("ok");
    const data = response.status === 204 ? null : await abortable(response.json().catch((error: unknown) => {
      if (isNetworkError(error)) throw error;
      return {};
    }), deadline.signal);
    return { response, data: data as T };
  } catch (error) {
    if (isNetworkError(error)) {
      reportRequestOutcome("network-error");
      // A failed real request is useful evidence to refresh the shared offline state,
      // including when there is no queued write waiting for the queue provider. A deadline
      // abort is also evidence, but a parent cancellation from unmount or drain abort is not.
      const ownDeadlineExpired = deadline.signal.aborted && !parentSignal?.aborted;
      if (ownDeadlineExpired || error instanceof TypeError || (error instanceof Error && error.message === "Failed to fetch")) {
        void probeReachability();
      }
    }
    throw error;
  } finally {
    deadline.cancel();
    parentSignal?.removeEventListener("abort", deadline.abort);
  }
}
