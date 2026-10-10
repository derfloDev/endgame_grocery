import type { TFunction } from "i18next";
import { AuthExpiredError } from "../../api/client";
import { ApiError, getErrorTranslationKey } from "../../api/errors";

/**
 * The one error shape of the list detail hooks.
 *
 * - `access`: the list is gone or not shared with this user (`message` is the translation key).
 * - `request`: anything else. `code` is the API's stable error code when there is one, `message`
 *   the English text to fall back to.
 *
 * Text is produced at render time with {@link getListDetailErrorText}, so a language change
 * re-translates a visible error without a reload.
 */
export interface ListDetailError {
  kind: "access" | "request";
  code?: string;
  message: string;
}

/** Translation key of the message shown when the list is no longer accessible. */
export const ACCESS_ERROR_KEY = "detail.accessError";

/** Client-side marker for an expired session; the app signs the user out, so no banner is shown. */
export const SESSION_EXPIRED_CODE = "client.session_expired";

export function createAccessError(): ListDetailError {
  return { kind: "access", message: ACCESS_ERROR_KEY };
}

/** Turns anything that was thrown into a {@link ListDetailError}. */
export function toListDetailError(error: unknown): ListDetailError {
  if (error instanceof AuthExpiredError) {
    return { kind: "request", code: SESSION_EXPIRED_CODE, message: error.message };
  }

  if (error instanceof ApiError) {
    return { kind: "request", ...(error.code ? { code: error.code } : {}), message: error.message };
  }

  return { kind: "request", message: error instanceof Error ? error.message : String(error) };
}

/** The error banner text in the current language. */
export function getListDetailErrorText(error: ListDetailError, t: TFunction): string {
  if (error.kind === "access") {
    return t(ACCESS_ERROR_KEY);
  }

  return error.code ? t(getErrorTranslationKey(error.code), { defaultValue: error.message }) : error.message;
}

/** An expired session is handled by signing out; it must not also show an error banner. */
export function isSessionExpiredError(error: ListDetailError | null): boolean {
  return error?.code === SESSION_EXPIRED_CODE;
}
