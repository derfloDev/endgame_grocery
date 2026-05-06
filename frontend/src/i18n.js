import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ICU from "i18next-icu";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";

function applyLangAttribute(language) {
  if (!language || typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = language.split("-")[0];
}

i18next
  .use(ICU)
  .use(LanguageDetector)
  .use(
    resourcesToBackend((language, namespace) => import(`./locales/${language}/${namespace}.json`))
  )
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: ["en", "de"],
    defaultNS: "translation",
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng"
    },
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

applyLangAttribute(i18next.language);
i18next.on("languageChanged", applyLangAttribute);

export default i18next;
