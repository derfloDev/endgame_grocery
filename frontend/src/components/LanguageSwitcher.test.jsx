import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18next from "i18next";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import LanguageSwitcher from "./LanguageSwitcher";

describe("LanguageSwitcher", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18next.changeLanguage("en");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the English and German language buttons", () => {
    render(<LanguageSwitcher />);

    expect(screen.getByRole("group", { name: "Language" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "DE" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "EN" })).toBeTruthy();
  });

  it("marks English as active when the current language is English", () => {
    render(<LanguageSwitcher />);

    expect(screen.getByRole("button", { name: "EN" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "DE" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("switches to German and persists the preference", async () => {
    render(<LanguageSwitcher />);

    await userEvent.click(screen.getByRole("button", { name: "DE" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "DE" }).getAttribute("aria-pressed")).toBe("true");
    });
    expect(localStorage.getItem("i18nextLng")).toBe("de");
  });
});
