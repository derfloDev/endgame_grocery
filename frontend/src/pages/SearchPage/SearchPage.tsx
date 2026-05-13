import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";
import styles from "./SearchPage.module.css";

export default function SearchPage(): ReactElement {
  const { t } = useTranslation();

  return (
    <div aria-label={t("search.pageLabel")} className={styles["search-page"]}>
      <h1 className={styles["search-page-title"]}>{t("search.title").toUpperCase()}</h1>
    </div>
  );
}
