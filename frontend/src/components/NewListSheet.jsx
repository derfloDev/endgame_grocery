import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "./ui";

export default function NewListSheet({ open, onAdd, onClose }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
    }
  }, [open]);

  function handleSubmit(event) {
    event?.preventDefault();

    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    onAdd?.(trimmed);
    setName("");
    onClose?.();
  }

  return (
    <BottomSheet open={open} title={t("list.newListTitle")} onClose={onClose}>
      <form className="new-list-form" onSubmit={handleSubmit}>
        <div className="eg-field">
          <label htmlFor="new-list-sheet-name">{t("list.newList")}</label>
          <input
            id="new-list-sheet-name"
            autoFocus
            className="eg-input"
            placeholder={t("list.newListPlaceholder")}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="button-row">
          <button className="eg-btn-ghost" type="button" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="eg-btn-primary" disabled={!name.trim()} type="submit">
            {t("list.createList")}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
