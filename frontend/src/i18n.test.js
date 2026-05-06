import { afterEach, describe, expect, it } from "vitest";
import deTranslations from "./locales/de/translation.json";

describe("i18n", () => {
  afterEach(async () => {
    const i18next = (await import("i18next")).default;
    i18next.off("languageChanged");
  });

  it("keeps the document language in sync with i18next", async () => {
    document.documentElement.lang = "en";
    const { default: i18next } = await import("./i18n");

    await i18next.changeLanguage("de");

    expect(document.documentElement.lang).toBe("de");
  });

  it("uses proper German umlauts and sharp s in the German catalog", () => {
    const values = Object.values(deTranslations).join("\n");

    expect(deTranslations["common.delete"]).toBe("Löschen");
    expect(deTranslations["common.close"]).toBe("Schließen");
    expect(deTranslations["common.back"]).toBe("Zurück");
    expect(deTranslations["common.add"]).toBe("Hinzufügen");
    expect(values).not.toMatch(
      /\b(?:Loeschen|Schliessen|Zurueck|Hinzufuegen|Aenderung|Aenderungen|fuer|Eintraege|oeffnen|ungueltig)\b/
    );
  });
});
