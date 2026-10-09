import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createInstance } from "i18next";
import deTranslations from "../locales/de/translation.json";
import enTranslations from "../locales/en/translation.json";
import { ApiError, getErrorMessage, getErrorTranslationKey } from "./errors";

async function createT(language: "en" | "de") {
  const instance = createInstance();
  await instance.init({
    lng: language,
    resources: { en: { translation: enTranslations }, de: { translation: deTranslations } },
    keySeparator: false,
    interpolation: { escapeValue: false }
  });

  return instance.t.bind(instance);
}

/** The codes the backend can send, read from its catalogue so a new code fails this test until translated. */
function backendErrorCodes(): string[] {
  const source = readFileSync(path.resolve(import.meta.dirname, "../../../backend/src/errors.js"), "utf8");
  const list = source.match(/ERROR_CODES = Object\.freeze\(\[([\s\S]*?)\]\)/)?.[1] ?? "";

  return [...list.matchAll(/"([a-z_.]+)"/g)].map((match) => match[1]);
}

describe("API error translations", () => {
  it("reads a non-empty catalogue from the backend", () => {
    expect(backendErrorCodes().length).toBeGreaterThan(40);
  });

  it("has an English and a German text for every backend error code", () => {
    const missing = backendErrorCodes().flatMap((code) =>
      (["en", "de"] as const).flatMap((language) => {
        const table = (language === "en" ? enTranslations : deTranslations) as Record<string, string>;
        return table[getErrorTranslationKey(code)] ? [] : [`${language}: ${getErrorTranslationKey(code)}`];
      })
    );

    expect(missing).toEqual([]);
  });

  it("has no translation for a code the backend does not know", () => {
    const codes = new Set(backendErrorCodes().map(getErrorTranslationKey));
    const stale = Object.keys(enTranslations).filter((key) => key.startsWith("errors.") && !codes.has(key));

    expect(stale).toEqual([]);
  });
});

describe("getErrorMessage", () => {
  it("translates an API error by its code in the current language", async () => {
    const error = new ApiError("You do not have access to this list.", 403, "list.forbidden");

    expect(getErrorMessage(error, await createT("en"))).toBe("You do not have access to this list.");
    expect(getErrorMessage(error, await createT("de"))).toBe("Du hast keinen Zugriff auf diese Liste.");
  });

  it("falls back to the server's message for a code without translation", async () => {
    const error = new ApiError("Server text", 400, "brand.new_code");

    expect(getErrorMessage(error, await createT("de"))).toBe("Server text");
  });

  it("uses the message of an API error that carries no code", async () => {
    expect(getErrorMessage(new ApiError("Bad gateway", 502), await createT("de"))).toBe("Bad gateway");
  });

  it("keeps the message of any other error and stringifies non-errors", async () => {
    const t = await createT("en");

    expect(getErrorMessage(new TypeError("Failed to fetch"), t)).toBe("Failed to fetch");
    expect(getErrorMessage("plain text", t)).toBe("plain text");
  });
});
