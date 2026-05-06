import { useTranslation } from "react-i18next";
import Icon from "./Icon";

export default function FAB({ onClick, icon = "plus" }) {
  const { t } = useTranslation();

  return (
    <button aria-label={t("fab.add")} className="fab" type="button" onClick={onClick}>
      <Icon name={icon} size={24} color="#080B1C" strokeWidth={2.5} />
    </button>
  );
}
