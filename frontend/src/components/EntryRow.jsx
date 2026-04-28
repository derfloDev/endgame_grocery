import { useRef, useState } from "react";
import { FALLBACK_ICON, FALLBACK_ICON_NAME, ICON_REGISTRY, resolveIconName } from "../data/iconRegistry";
import { Icon } from "./ui";

export default function EntryRow({ entry, onDelete, onEdit, onToggle }) {
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const currentDx = useRef(0);
  const resolvedIconName = resolveIconName(entry.icon);
  const EntryIcon = ICON_REGISTRY[resolvedIconName] ?? FALLBACK_ICON;

  function handleTouchStart(event) {
    startX.current = event.touches[0].clientX;
    currentDx.current = 0;
    setSwiping(true);
  }

  function handleTouchMove(event) {
    currentDx.current = event.touches[0].clientX - startX.current;

    if (currentDx.current < 0) {
      setSwipeX(Math.max(currentDx.current, -100));
    }
  }

  function handleTouchEnd() {
    setSwiping(false);

    if (currentDx.current < -80) {
      setSwipeX(0);
      onDelete?.();
    } else {
      setSwipeX(0);
    }

    currentDx.current = 0;
  }

  return (
    <div className="entry-row-wrapper">
      <div aria-hidden="true" className="entry-delete-zone">
        <Icon color="var(--color-error)" name="trash" size={20} />
      </div>

      <div
        className={`entry-row ${entry.status === "done" ? "entry-row-done" : ""}`}
        data-testid={`entry-row-${entry.id}`}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swiping ? "none" : "transform 0.25s var(--ease-out)"
        }}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
      >
        <button
          aria-label={entry.status === "done" ? `Mark ${entry.text} open` : `Mark ${entry.text} done`}
          className="eg-icon-btn entry-icon-btn"
          type="button"
          onClick={() => onToggle?.()}
        >
          <Icon
            color={entry.status === "done" ? "var(--color-success)" : "var(--text-disabled)"}
            name="checkCircle"
            size={22}
          />
        </button>

        <EntryIcon
          aria-hidden="true"
          className={`entry-icon ${entry.status === "done" ? "entry-row-done" : ""}`}
          data-icon-name={resolvedIconName ?? FALLBACK_ICON_NAME}
          data-testid={`entry-row-icon-${entry.id}`}
          size={22}
          stroke={1.5}
        />

        <div className="entry-row-copy">
          <p className={`entry-row-text ${entry.status === "done" ? "entry-row-text-done" : ""}`}>{entry.text}</p>
          {entry.details ? <p className="entry-row-details">{entry.details}</p> : null}
          {entry.is_pending_sync ? <span className="eg-chip-queued entry-row-chip">Queued</span> : null}
        </div>

        <button
          aria-label={`Edit ${entry.text}`}
          className="eg-icon-btn entry-icon-btn"
          type="button"
          onClick={() => onEdit?.()}
        >
          <Icon color="var(--text-secondary)" name="edit" size={18} />
        </button>
      </div>
    </div>
  );
}
