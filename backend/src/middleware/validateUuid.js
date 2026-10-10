import { ApiError } from "../errors.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks whether a value is a UUID string. Malformed identifiers must be rejected before they
 * reach a `uuid` column, where PostgreSQL would answer with a 22P02 error.
 *
 * @param {unknown} value Candidate identifier.
 * @returns {boolean} Whether the value has the UUID shape.
 */
export function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Creates an Express param callback (for `router.param` / `app.param`) that fails the request with
 * an API error, and does not continue, when the parameter is not a UUID.
 *
 * @param {string} code API error code of the response (see `errors.js`).
 * @param {string} message English error text of the response.
 * @param {number} [status] HTTP status of the response (404 by default: the resource cannot exist).
 * @returns {import("express").RequestParamHandler} Param callback.
 */
export function uuidParam(code, message, status = 404) {
  return (_req, _res, next, value) => {
    if (!isUuid(value)) {
      next(new ApiError(status, code, message));
      return;
    }

    next();
  };
}
