import pino from "pino";

const REDACTED = "[redacted]";
const INVITE_PATH_PREFIX = "/api/invites/";

/**
 * Request header values that must never reach a log line, even if a serializer starts emitting
 * headers later.
 */
export const REDACT_PATHS = [
  "req.headers.authorization",
  'req.headers["x-api-key"]',
  "req.headers.cookie"
];

/**
 * Removes credentials from a request URL before it is logged: the query string (it can carry
 * `?token=` style values) and the invite token path segment.
 *
 * @param {string | undefined} url Request URL as received.
 * @returns {string} Path that is safe to log.
 */
export function sanitizeRequestUrl(url) {
  if (typeof url !== "string") {
    return "";
  }

  const queryStart = url.indexOf("?");
  const path = queryStart === -1 ? url : url.slice(0, queryStart);

  if (!path.startsWith(INVITE_PATH_PREFIX)) {
    return path;
  }

  const rest = path.slice(INVITE_PATH_PREFIX.length);
  const slash = rest.indexOf("/");

  return `${INVITE_PATH_PREFIX}:token${slash === -1 ? "" : rest.slice(slash)}`;
}

/**
 * pino-http request serializer that logs only the method, the sanitised path and the remote
 * address. Headers (Authorization, X-Api-Key, cookies) are deliberately left out.
 *
 * @param {import("http").IncomingMessage & { originalUrl?: string }} req Incoming request.
 * @returns {{ method: string | undefined, url: string, remoteAddress: string | undefined }} Log fields.
 */
export function serializeRequest(req) {
  return {
    method: req.method,
    url: sanitizeRequestUrl(req.originalUrl ?? req.url),
    remoteAddress: req.remoteAddress ?? req.socket?.remoteAddress
  };
}

/**
 * Creates a logger that redacts credential headers.
 *
 * @param {import("pino").LoggerOptions} [options] Extra pino options.
 * @param {import("pino").DestinationStream} [destination] Optional destination stream.
 * @returns {import("pino").Logger} Logger instance.
 */
export function createLogger(options = {}, destination) {
  return pino(
    {
      level: process.env.LOG_LEVEL ?? "info",
      redact: { paths: REDACT_PATHS, censor: REDACTED },
      ...options
    },
    destination
  );
}

export const logger = createLogger();

export default logger;
