/**
 * Returns `value` when it is a path inside this app and `/` otherwise.
 *
 * The login page follows a `redirect` query parameter or router state after signing in. Accepting
 * any string would allow open redirects such as `//evil.example`, `/\evil.example` (browsers treat
 * the backslash like a slash) or absolute URLs, so only a single leading slash followed by
 * something other than `/` or `\` is accepted. Control characters are rejected because browsers
 * strip tabs and newlines inside URLs, which would turn `/\t/evil.example` into `//evil.example`.
 */
export function getSafeRedirect(value: unknown): string {
  if (typeof value !== "string") {
    return "/";
  }

  const isInAppPath = /^\/(?![/\\])/.test(value) && !/[\u0000-\u001f\u007f]/.test(value);

  return isInAppPath ? value : "/";
}
