import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";
import BottomSheet from "../ui/BottomSheet/BottomSheet";
import Icon from "../ui/Icon/Icon";
import styles from "./ListOptionsSheet.module.css";

interface ListOptionsSheetProps {
  open: boolean;
  onClose: () => void;
  isOwner: boolean;
  onLeaveSelect?: () => void;
  onRenameSelect?: () => void;
  onShareSelect?: () => void;
}

export default function ListOptionsSheet({
  open,
  onClose,
  isOwner,
  onLeaveSelect,
  onRenameSelect,
  onShareSelect
}: ListOptionsSheetProps): ReactElement | null {
  const { t } = useTranslation();

  if (!open) {
    return null;
  }

  return (
    <BottomSheet open={open} title={t("list.optionsTitle")} onClose={onClose}>
      <div className={styles["list-options-sheet"]}>
        {isOwner ? (
          <>
            <button
              className={styles["list-option-row"]}
              type="button"
              onClick={() => {
                onClose();
                onRenameSelect?.();
              }}
            >
              <div className={`${styles["list-option-icon"]} ${styles["list-option-icon-edit"]}`}>
                <Icon color="var(--neon-violet)" name="edit" size={22} />
              </div>
              <div className={styles["list-option-text"]}>
                <span className={styles["list-option-label"]}>{t("list.optionsRename")}</span>
                <span className={styles["list-option-desc"]}>{t("list.optionsRenameDesc")}</span>
              </div>
              <Icon color="var(--text-disabled)" name="chevronRight" size={16} />
            </button>

            <button
              className={styles["list-option-row"]}
              type="button"
              onClick={() => {
                onClose();
                onShareSelect?.();
              }}
            >
              <div className={`${styles["list-option-icon"]} ${styles["list-option-icon-share"]}`}>
                <Icon color="var(--neon-cyan)" name="share" size={22} />
              </div>
              <div className={styles["list-option-text"]}>
                <span className={styles["list-option-label"]}>{t("list.optionsShare")}</span>
                <span className={styles["list-option-desc"]}>{t("list.optionsShareDesc")}</span>
              </div>
              <Icon color="var(--text-disabled)" name="chevronRight" size={16} />
            </button>
          </>
        ) : (
          <button
            className={styles["list-option-row"]}
            type="button"
            onClick={() => {
              onClose();
              onLeaveSelect?.();
            }}
          >
            <div className={`${styles["list-option-icon"]} ${styles["list-option-icon-leave"]}`}>
              <Icon color="var(--danger)" name="logOut" size={22} />
            </div>
            <div className={styles["list-option-text"]}>
              <span className={styles["list-option-label"]}>{t("list.leaveList")}</span>
              <span className={styles["list-option-desc"]}>{t("list.leaveListDesc")}</span>
            </div>
            <Icon color="var(--text-disabled)" name="chevronRight" size={16} />
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
