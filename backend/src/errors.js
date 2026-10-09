/**
 * Stable machine-readable error codes of the HTTP API.
 *
 * Every error response is `{ error, code }`: `error` is an English message for API clients and
 * logs, `code` never changes and is what the web app translates (`errors.<code>` in the locale
 * files; a test fails when a code has no DE/EN text). Add a code here before throwing it.
 */
export const ERROR_CODES = Object.freeze([
  "auth.api_key_required",
  "auth.email_not_verified",
  "auth.email_taken",
  "auth.invalid_api_key",
  "auth.invalid_credentials",
  "auth.invalid_ticket",
  "auth.invalid_token",
  "auth.registration_disabled",
  "auth.reset_invalid",
  "auth.token_required",
  "auth.verification_invalid",
  "conflict.duplicate",
  "entry.limit_open",
  "entry.not_found",
  "internal.error",
  "invite.email_mismatch",
  "invite.invalid",
  "invite.owner_cannot_accept",
  "item.not_found",
  "list.forbidden",
  "list.not_found",
  "list.owner_cannot_be_removed",
  "list.owner_cannot_leave",
  "list.owner_only_delete",
  "list.owner_only_rename",
  "list.owner_only_sharing",
  "push.endpoint_required",
  "push.endpoint_unsupported",
  "push.subscription_fields_required",
  "rate_limited",
  "reference.not_found",
  "request.invalid_json",
  "request.not_found",
  "request.too_large",
  "request.invalid_value",
  "sharing.already_has_access",
  "sharing.member_not_found",
  "user.not_found",
  "validation.email_required",
  "validation.entry_status_invalid",
  "validation.entry_text_required",
  "validation.entry_update_required",
  "validation.history_text_required",
  "validation.item_description_invalid",
  "validation.item_name_required",
  "validation.list_name_required",
  "validation.password_invalid",
  "validation.password_too_long",
  "validation.password_too_short",
  "validation.credentials_required",
  "validation.registration_fields_required",
  "validation.suggestion_query_short",
  "validation.token_password_required",
  "validation.verification_token_required"
]);

const KNOWN_CODES = new Set(ERROR_CODES);

/** An error that the central handler turns into `{ error, code }` with the given HTTP status. */
export class ApiError extends Error {
  /**
   * @param {number} status HTTP status code.
   * @param {string} code Stable code from {@link ERROR_CODES}.
   * @param {string} message English message for API clients.
   */
  constructor(status, code, message) {
    super(message);

    if (!KNOWN_CODES.has(code)) {
      throw new TypeError(`Unknown API error code: ${code}`);
    }

    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** The JSON body of an error response. */
export function toErrorBody(error) {
  return { error: error.message, code: error.code };
}

// PostgreSQL errors that mean "the request was wrong", not "the server is broken".
const PG_ERRORS = {
  "22P02": new ApiError(400, "request.invalid_value", "Invalid identifier or value."),
  "23505": new ApiError(409, "conflict.duplicate", "That item already exists."),
  "23503": new ApiError(404, "reference.not_found", "A referenced item does not exist.")
};

/**
 * Maps any error to the API error that should be sent, or null for an unexpected server error.
 *
 * @param {unknown} error Error passed to `next()`.
 * @returns {ApiError | null} API error to send, or null when the error is an internal failure.
 */
export function toApiError(error) {
  if (error instanceof ApiError) {
    return error;
  }

  if (error && typeof error === "object") {
    if ("type" in error && error.type === "entity.parse.failed") {
      return new ApiError(400, "request.invalid_json", "Request body is not valid JSON.");
    }

    if ("type" in error && error.type === "entity.too.large") {
      return new ApiError(413, "request.too_large", "Request body is too large.");
    }

    if ("code" in error && typeof error.code === "string" && PG_ERRORS[error.code]) {
      return PG_ERRORS[error.code];
    }
  }

  return null;
}

/** Answer for an `/api` path that no route handles. */
export function createNotFoundError() {
  return new ApiError(404, "request.not_found", "Not found.");
}

/**
 * Pool stand-in for an app created without a database. Routes call it like a real pool, so they
 * need no "is there a pool" guard of their own: any use fails with one clear message, which the
 * central handler logs and answers as `internal.error`.
 */
export function createUnavailablePool() {
  const fail = () => Promise.reject(new Error("Database connection is not configured."));

  return { query: fail, connect: fail };
}
