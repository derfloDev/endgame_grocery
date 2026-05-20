import { useEffect, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import BottomSheet from "../ui/BottomSheet/BottomSheet";
import styles from "./RenameListSheet.module.css";

interface RenameListSheetProps {
  open: boolean;
  onClose: () => void;
  currentName: string;
  onRename?: (name: string) => Promise<void> | void;
}

export default function RenameListSheet({ open, onClose, currentName, onRename }: RenameListSheetProps): ReactElement {
  const { t } = useTranslation();
  const [value, setValue] = useState(currentName);

  useEffect(() => {
    if (open) {
      setValue(currentName);
    }
  }, [currentName, open]);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>): Promise<void> {
    event?.preventDefault();

    const trimmed = value.trim();

    if (!trimmed || trimmed === currentName) {
      return;
    }

    await onRename?.(trimmed);
    onClose?.();
  }

  return (
    <BottomSheet open={open} title={t("list.renameList")} onClose={onClose}>
      <form className={styles["rename-list-form"]} onSubmit={(event) => void handleSubmit(event)}>
        <div className="eg-field">
          <label htmlFor="rename-list-sheet-value">{t("list.renameList")}</label>
          <input
            id="rename-list-sheet-value"
            autoFocus
            className="eg-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <div className="button-row">
          <button className="eg-btn-ghost" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="eg-btn-primary" disabled={!value.trim() || value.trim() === currentName} type="submit">
            {t("common.save")}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
