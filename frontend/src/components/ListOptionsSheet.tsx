import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";
import { BottomSheet, Icon } from "./ui";

interface ListOptionsSheetProps {
  open: boolean;
  onClose: () => void;
  isOwner: boolean;
  onRenameSelect?: () => void;
  onShareSelect?: () => void;
}

export default function ListOptionsSheet({
  open,
  onClose,
  isOwner,
  onRenameSelect,
  onShareSelect
}: ListOptionsSheetProps): ReactElement | null {
  const { t } = useTranslation();

  if (!open || !isOwner) {
    return null;
  }

  return (
    <BottomSheet open={open} title={t("list.optionsTitle")} onClose={onClose}>
      <div className="list-options-sheet">
        <button
          className="list-option-row"
          type="button"
          onClick={() => {
            onClose?.();
            onRenameSelect?.();
          }}
        >
          <div className="list-option-icon list-option-icon-edit">
            <Icon color="var(--neon-violet)" name="edit" size={22} />
          </div>
          <div className="list-option-text">
            <span className="list-option-label">{t("list.optionsRename")}</span>
            <span className="list-option-desc">{t("list.optionsRenameDesc")}</span>
          </div>
          <Icon color="var(--text-disabled)" name="chevronRight" size={16} />
        </button>

        <button
          className="list-option-row"
          type="button"
          onClick={() => {
            onClose?.();
            onShareSelect?.();
          }}
        >
          <div className="list-option-icon list-option-icon-share">
            <Icon color="var(--neon-cyan)" name="share" size={22} />
          </div>
          <div className="list-option-text">
            <span className="list-option-label">{t("list.optionsShare")}</span>
            <span className="list-option-desc">{t("list.optionsShareDesc")}</span>
          </div>
          <Icon color="var(--text-disabled)" name="chevronRight" size={16} />
        </button>
      </div>
    </BottomSheet>
  );
}
