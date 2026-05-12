import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";

export default function SearchPage(): ReactElement {
  const { t } = useTranslation();

  return (
    <div aria-label={t("search.pageLabel")} className="search-page">
      <h1 className="search-page-title">{t("search.title").toUpperCase()}</h1>
    </div>
  );
}
