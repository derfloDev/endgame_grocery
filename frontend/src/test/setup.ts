import { configure } from "@testing-library/react";
import { beforeEach } from "vitest";

// Lazy route and sheet chunks are transformed on first import, which can take longer than the
// default 1 s `findBy*` timeout on a cold or busy machine. Passing tests are not slowed down.
configure({ asyncUtilTimeout: 4000 });

beforeEach(async () => {
  if (typeof document === "undefined") {
    return;
  }

  const { default: i18next } = await import("i18next");
  await import("../i18n");

  await i18next.changeLanguage("en");
});
