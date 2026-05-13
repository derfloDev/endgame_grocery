import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";
import styles from "./LanguageSwitcher.module.css";

const LANGUAGES = [
  { code: "de", label: "DE" },
  { code: "en", label: "EN" }
] as const;

type LanguageCode = (typeof LANGUAGES)[number]["code"];

function isLanguageCode(language: string | undefined): language is LanguageCode {
  return LANGUAGES.some(({ code }) => code === language);
}

function normalizeLanguage(language: string | undefined): LanguageCode {
  const baseLanguage = language?.split("-")[0];
  return isLanguageCode(baseLanguage) ? baseLanguage : "en";
}

export default function LanguageSwitcher(): ReactElement {
  const { i18n, t } = useTranslation();
  const activeLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);

  function handleLanguageChange(language: LanguageCode): void {
    void i18n.changeLanguage(language);
  }

  return (
    <div className={styles["language-switcher"]} role="group" aria-label={t("settings.languageLabel")}>
      {LANGUAGES.map(({ code, label }) => {
        const isActive = activeLanguage === code;

        return (
          <button
            key={code}
            aria-pressed={isActive}
            className={[
              styles["language-switcher-button"],
              isActive ? styles["language-switcher-button-active"] : ""
            ].filter(Boolean).join(" ")}
            type="button"
            onClick={() => handleLanguageChange(code)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
