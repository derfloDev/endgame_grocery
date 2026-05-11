import { useTranslation } from "react-i18next";
import { FALLBACK_ICON, FALLBACK_ICON_NAME, ICON_REGISTRY, resolveIconName } from "../data/iconRegistry";
import { useLongPress } from "../hooks/useLongPress";

export default function EntryTile({ entry, onEdit, onToggle }) {
  const { t } = useTranslation();
  const resolvedIconName = resolveIconName(entry.icon);
  const EntryIcon = ICON_REGISTRY[resolvedIconName] ?? FALLBACK_ICON;
  const { pressing, longPressHandlers } = useLongPress(() => onEdit?.(), 500);

  return (
    <button
      aria-label={
        entry.status === "done" ? t("entry.markOpen", { name: entry.text }) : t("entry.markDone", { name: entry.text })
      }
      className={[
        "entry-tile",
        entry.status === "done" ? "entry-tile--done" : "",
        pressing ? "entry-tile--pressing" : "",
        entry.is_pending_sync ? "entry-tile--pending" : ""
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
        className="entry-tile-icon"
        data-icon-name={resolvedIconName ?? FALLBACK_ICON_NAME}
        data-testid={`entry-tile-icon-${entry.id}`}
        size={24}
        stroke={1.5}
      />
      <p className="entry-tile-text">{entry.text}</p>
      {entry.details ? <p className="entry-tile-details">{entry.details}</p> : null}
      {entry.is_pending_sync ? <span className="eg-chip-queued entry-tile-chip">{t("common.queued")}</span> : null}
    </button>
  );
}
