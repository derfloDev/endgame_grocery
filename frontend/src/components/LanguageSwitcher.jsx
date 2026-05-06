import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "de", label: "DE" },
  { code: "en", label: "EN" }
];

function normalizeLanguage(language) {
  const baseLanguage = language?.split("-")[0];
  return LANGUAGES.some(({ code }) => code === baseLanguage) ? baseLanguage : "en";
}

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const activeLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);

  function handleLanguageChange(language) {
    void i18n.changeLanguage(language);
  }

  return (
    <div className="language-switcher" role="group" aria-label={t("settings.languageLabel")}>
      {LANGUAGES.map(({ code, label }) => {
        const isActive = activeLanguage === code;

        return (
          <button
            key={code}
            aria-pressed={isActive}
            className={`language-switcher-button${isActive ? " language-switcher-button-active" : ""}`}
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
