import { useTranslation } from "react-i18next";
import Icon from "../Icon/Icon";
import styles from "./FAB.module.css";
import type { IconName } from "../Icon/Icon";
import type { ReactElement } from "react";

interface FABProps {
  onClick: () => void;
  icon?: IconName | string;
}

export default function FAB({ onClick, icon = "plus" }: FABProps): ReactElement {
  const { t } = useTranslation();

  return (
    <button aria-label={t("fab.add")} className={styles.fab} type="button" onClick={onClick}>
      <Icon name={icon} size={24} color="#080B1C" strokeWidth={2.5} />
    </button>
  );
}
