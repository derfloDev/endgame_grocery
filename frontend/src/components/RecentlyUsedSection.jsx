import { FALLBACK_ICON, ICON_REGISTRY } from "../data/iconRegistry";
import { Icon } from "./ui";

const FALLBACK_ICON_NAME = "IconShoppingCart";

function resolveIconName(iconName) {
  if (!iconName) {
    return FALLBACK_ICON_NAME;
  }

  return ICON_REGISTRY[iconName] ? iconName : FALLBACK_ICON_NAME;
}

export default function RecentlyUsedSection({ items, onAdd, onDismiss }) {
  if (!items.length) {
    return null;
  }

  return (
    <section aria-label="Recently Used" className="entry-section recently-used-section">
      <div className="entry-section-header">
        <span className="detail-section-label">RECENTLY USED</span>
        <span className="eg-chip-purple">{items.length}</span>
      </div>

      <div className="recently-used-list">
        {items.map((item) => {
          const resolvedIconName = resolveIconName(item.icon);
          // Keep a stable icon slot even when history items do not have a persisted icon.
          const ItemIcon = ICON_REGISTRY[resolvedIconName] ?? FALLBACK_ICON;

          return (
            <div key={item.text} className="recently-used-chip-row">
              <button
                aria-label={item.text}
                className="recently-used-chip"
                type="button"
                onClick={() => onAdd?.(item.text, item.icon ?? null)}
              >
                <ItemIcon
                  aria-hidden="true"
                  className="recently-used-chip-icon"
                  data-icon-name={resolvedIconName}
                  size={18}
                  stroke={1.6}
                />
                <span className="recently-used-chip-text">{item.text}</span>
              </button>

              <button
                aria-label={`Dismiss ${item.text}`}
                className="recently-used-chip-dismiss"
                type="button"
                onClick={() => onDismiss?.(item.text)}
              >
                <Icon color="var(--text-secondary)" name="x" size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
