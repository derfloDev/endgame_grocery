// Must equal frontend/src/sw/navigationHandler.js; enforced by frontend/src/sw/navigationHandler.test.js.
export const RECONNECT_PARAM = "__reconnect";

export function buildReconnectUrl(location: Pick<Location, "href">, now: number): string {
  const url = new URL(location.href);
  url.searchParams.set(RECONNECT_PARAM, String(now));
  return url.href;
}

/** A top-level navigation lets the edge show login/challenge while IndexedDB stays intact. */
export function reconnect(): void {
  window.location.assign(buildReconnectUrl(window.location, Date.now()));
}

/** Remove only the navigation control parameter before React observes the initial URL. */
export function stripReconnectParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(RECONNECT_PARAM)) return;
  url.searchParams.delete(RECONNECT_PARAM);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}
