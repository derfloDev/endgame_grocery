import { describe, expect, it, vi } from "vitest";
import type { TFunction } from "i18next";
import { AuthExpiredError } from "../../api/client";
import { ApiError } from "../../api/errors";
import {
  ACCESS_ERROR_KEY,
  SESSION_EXPIRED_CODE,
  createAccessError,
  getListDetailErrorText,
  isSessionExpiredError,
  toListDetailError
} from "./listDetailErrors";

const t = vi.fn((key: string, options?: { defaultValue?: string }) =>
  key.startsWith("errors.") || key === ACCESS_ERROR_KEY ? `translated(${key})` : (options?.defaultValue ?? key)
) as unknown as TFunction;

describe("toListDetailError", () => {
  it("keeps the code and message of an API error", () => {
    expect(toListDetailError(new ApiError("Entry not found.", 404, "entry.not_found"))).toEqual({
      kind: "request",
      code: "entry.not_found",
      message: "Entry not found."
    });
  });

  it("leaves the code out when the API sent none", () => {
    expect(toListDetailError(new ApiError("Bad gateway", 502))).toEqual({ kind: "request", message: "Bad gateway" });
  });

  it("marks an expired session", () => {
    const error = toListDetailError(new AuthExpiredError());

    expect(error).toMatchObject({ kind: "request", code: SESSION_EXPIRED_CODE });
    expect(isSessionExpiredError(error)).toBe(true);
  });

  it.each([
    [new Error("Failed to fetch"), "Failed to fetch"],
    ["plain text", "plain text"]
  ])("wraps other failures as a request error (%s)", (thrown, message) => {
    expect(toListDetailError(thrown)).toEqual({ kind: "request", message });
  });
});

describe("getListDetailErrorText", () => {
  it("translates the access error", () => {
    expect(getListDetailErrorText(createAccessError(), t)).toBe(`translated(${ACCESS_ERROR_KEY})`);
  });

  it("translates an API error by its code at render time, falling back to the server text", () => {
    expect(getListDetailErrorText({ kind: "request", code: "entry.not_found", message: "Entry not found." }, t)).toBe(
      "translated(errors.entry.not_found)"
    );
  });

  it("shows the message of an error without a code as is", () => {
    expect(getListDetailErrorText({ kind: "request", message: "Failed to fetch" }, t)).toBe("Failed to fetch");
  });
});

describe("isSessionExpiredError", () => {
  it("is false for other errors and for no error", () => {
    expect(isSessionExpiredError(null)).toBe(false);
    expect(isSessionExpiredError({ kind: "request", message: "x" })).toBe(false);
    expect(isSessionExpiredError(createAccessError())).toBe(false);
  });
});
