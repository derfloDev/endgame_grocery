import type { TFunction } from "i18next";

/**
 * A non-OK answer of the API: HTTP `status`, the stable `code` from the server's `{ error, code }`
 * body (empty when the body had none, for example a proxy error page) and the server's English
 * `message` as a fallback text.
 */
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Locale key of the translated text for an API error code. */
export function getErrorTranslationKey(code: string): string {
  return `errors.${code}`;
}

/**
 * The one place that turns a caught error into text for the user.
 *
 * API errors with a code are shown in the current language (`errors.<code>`), falling back to the
 * server's English message when a code has no translation yet. Everything else (network failures,
 * programming errors, already formatted strings) keeps its own message.
 */
export function getErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError && error.code) {
    return t(getErrorTranslationKey(error.code), { defaultValue: error.message });
  }

  return error instanceof Error ? error.message : String(error);
}
