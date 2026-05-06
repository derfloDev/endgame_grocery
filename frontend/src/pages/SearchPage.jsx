import { useTranslation } from "react-i18next";

export default function SearchPage() {
  const { t } = useTranslation();

  return (
    <div aria-label={t("search.pageLabel")} className="search-page">
      <h1 className="search-page-title">{t("search.title").toUpperCase()}</h1>
    </div>
  );
}
