import { beforeEach } from "vitest";

beforeEach(async () => {
  if (typeof document === "undefined") {
    return;
  }

  const { default: i18next } = await import("i18next");
  await import("../i18n");

  await i18next.changeLanguage("en");
});
