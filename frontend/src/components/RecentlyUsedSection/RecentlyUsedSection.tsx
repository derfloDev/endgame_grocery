import { useTranslation } from "react-i18next";
import { FALLBACK_ICON, FALLBACK_ICON_NAME, ICON_REGISTRY, resolveIconName } from "../../data/iconRegistry";
import type { Suggestion } from "../../types";
import type { ReactElement } from "react";
import styles from "./RecentlyUsedSection.module.css";

interface RecentlyUsedSectionProps {
  items: Suggestion[];
  onAdd?: (text: string, iconName: string | null, details?: string) => void;
}

export default function RecentlyUsedSection({
  items,
  onAdd
}: RecentlyUsedSectionProps): ReactElement | null {
  const { t } = useTranslation();

  if (!items.length) {
    return null;
  }

  return (
    <section aria-label={t("recent.sectionLabel")} className={`entry-section ${styles["recently-used-section"]}`}>
      <div className="entry-section-header">
        <span className="detail-section-label">{t("recent.sectionLabel").toUpperCase()}</span>
        <span className="eg-chip-purple">{items.length}</span>
      </div>

      <div className={styles["recently-used-grid"]} data-testid="recently-used-grid">
        {items.map((item) => {
          const resolvedIconName = resolveIconName(item.icon) ?? FALLBACK_ICON_NAME;
          const ItemIcon = ICON_REGISTRY[resolvedIconName] ?? FALLBACK_ICON;

          return (
            <div key={item.text} className={styles["recently-used-cell"]} data-testid="recently-used-cell">
              <button
                aria-label={item.text}
                className={styles["recently-used-chip"]}
                type="button"
                onClick={() => onAdd?.(item.text, item.icon ?? null, item.details)}
              >
                <ItemIcon
                  aria-hidden="true"
                  className={styles["recently-used-chip-icon"]}
                  data-icon-name={resolvedIconName}
                  size={20}
                  stroke={1.6}
                />
                <span className={styles["recently-used-chip-text"]}>{item.text}</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
