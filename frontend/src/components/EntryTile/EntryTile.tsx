import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { FALLBACK_ICON, FALLBACK_ICON_NAME, ICON_REGISTRY, resolveIconName } from "../../data/iconRegistry";
import { useLongPress } from "../../hooks/useLongPress";
import type { Entry } from "../../types";
import type { ReactElement } from "react";
import styles from "./EntryTile.module.css";

/** The API returns `null` for entries without details; the tile treats it like "absent". */
type TileEntry = Omit<Entry, "details"> & { details?: string | null };

interface EntryTileProps {
  entry: TileEntry;
  changeKind?: "new" | "edited" | "done";
  /** Receives the entry id, so a parent can pass one stable handler to every tile. */
  onEdit?: (entryId: string) => void;
  onToggle?: (entryId: string) => void;
}

/**
 * One entry of the list. Memoised: with stable `onEdit`/`onToggle` handlers and the original entry
 * object, tiles whose entry did not change are skipped when the page re-renders (search typing,
 * unrelated state), which matters with a thousand open entries.
 */
function EntryTile({ entry, changeKind, onEdit, onToggle }: EntryTileProps): ReactElement {
  const { t } = useTranslation();
  const resolvedIconName = resolveIconName(entry.icon);
  const displayIconName = resolvedIconName ?? FALLBACK_ICON_NAME;
  const EntryIcon = ICON_REGISTRY[displayIconName] ?? FALLBACK_ICON;
  const { pressing, longPressHandlers } = useLongPress(() => onEdit?.(entry.id), 500);
  const changeLabel = changeKind ? getChangeLabel(changeKind, t) : "";

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
          onToggle?.(entry.id);
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
      {entry.is_changed && changeLabel ? (
        <span className={styles["entry-tile-change-badge"]}>{changeLabel}</span>
      ) : null}
      {entry.is_pending_sync ? <span className={`eg-chip-queued ${styles["entry-tile-chip"]}`}>{t("common.queued")}</span> : null}
    </button>
  );
}

export default memo(EntryTile);

function getChangeLabel(changeKind: NonNullable<EntryTileProps["changeKind"]>, t: TFunction): string {
  if (changeKind === "done") {
    return t("entry.changeDone");
  }

  if (changeKind === "edited") {
    return t("entry.changeEdited");
  }

  return t("entry.changeNew");
}
