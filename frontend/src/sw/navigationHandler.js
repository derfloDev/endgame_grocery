export const NAVIGATION_NETWORK_TIMEOUT_MS = 3000;
export const RECONNECT_PARAM = "__reconnect";

export function createNavigationHandler({
  fetchImpl = fetch,
  fallback,
  timeoutMs = NAVIGATION_NETWORK_TIMEOUT_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout
}) {
  return async (options) => {
    const { request, url } = options;
    let timer;
    let response;
    try {
      // Always reach the origin so a top-level navigation can recover an edge session.
      // Never cache navigation responses: login/challenge HTML must not replace the shell.
      const network = fetchImpl(request);
      if (url.searchParams.has(RECONNECT_PARAM)) {
        // An explicit reconnect must give Access/challenges all the time they need.
        response = await network;
      } else {
        response = await Promise.race([
          network,
          new Promise(resolve => { timer = setTimer(() => resolve(null), timeoutMs); })
        ]);
      }
    } catch {
      // A rejected fetch uses the precached offline-capable shell below.
    } finally {
      // The late network promise is observed by the race but cannot replace the result.
      if (timer !== undefined) clearTimer(timer);
    }

    // Preserve gates and redirects for the browser to complete the access flow.
    if (response && (
      response.type === "opaqueredirect" || response.ok ||
      (response.status >= 300 && response.status < 400) ||
      response.status === 401 || response.status === 403 ||
      response.headers.get("cf-mitigated") === "challenge"
    )) return response;

    // Offline, timeout and origin errors (including 5xx/52x) keep the usable app shell.
    return fallback(options);
  };
}
