import { useTranslation } from "react-i18next";
import { FALLBACK_ICON, FALLBACK_ICON_NAME, ICON_REGISTRY, resolveIconName } from "../../data/iconRegistry";
import { useLongPress } from "../../hooks/useLongPress";
import type { Entry } from "../../types";
import type { ReactElement } from "react";
import styles from "./EntryTile.module.css";

interface EntryTileProps {
  entry: Entry;
  onEdit?: () => void;
  onToggle?: () => void;
}

export default function EntryTile({ entry, onEdit, onToggle }: EntryTileProps): ReactElement {
  const { t } = useTranslation();
  const resolvedIconName = resolveIconName(entry.icon);
  const displayIconName = resolvedIconName ?? FALLBACK_ICON_NAME;
  const EntryIcon = ICON_REGISTRY[displayIconName] ?? FALLBACK_ICON;
  const { pressing, longPressHandlers } = useLongPress(() => onEdit?.(), 500);

  return (
    <button
      aria-label={
        entry.status === "done" ? t("entry.markOpen", { name: entry.text }) : t("entry.markDone", { name: entry.text })
      }
      className={[
        styles["entry-tile"],
        entry.status === "done" ? styles["entry-tile--done"] : "",
        pressing ? styles["entry-tile--pressing"] : "",
        entry.is_pending_sync ? styles["entry-tile--pending"] : ""
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid={`entry-tile-${entry.id}`}
      type="button"
      {...longPressHandlers}
      onClick={(event) => {
        longPressHandlers.onClick(event);
        if (!event.defaultPrevented) {
          onToggle?.();
        }
      }}
    >
      <EntryIcon
        aria-hidden="true"
        className={styles["entry-tile-icon"]}
        data-icon-name={displayIconName}
        data-testid={`entry-tile-icon-${entry.id}`}
        size={24}
        stroke={1.5}
      />
      <p className={styles["entry-tile-text"]}>{entry.text}</p>
      {entry.details ? <p className={styles["entry-tile-details"]}>{entry.details}</p> : null}
      {entry.is_pending_sync ? <span className={`eg-chip-queued ${styles["entry-tile-chip"]}`}>{t("common.queued")}</span> : null}
    </button>
  );
}
