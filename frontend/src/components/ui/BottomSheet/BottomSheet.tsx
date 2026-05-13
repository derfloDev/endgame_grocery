import { useTranslation } from "react-i18next";
import type { ReactElement, ReactNode } from "react";
import styles from "./BottomSheet.module.css";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  browserOpen?: boolean;
  className?: string;
  children?: ReactNode;
}

export default function BottomSheet({
  open,
  onClose,
  title,
  browserOpen = false,
  className = "",
  children
}: BottomSheetProps): ReactElement | null {
  const { t } = useTranslation();

  if (!open) {
    return null;
  }

  const resolvedClassName = [
    styles["bottom-sheet"],
    browserOpen && styles["bottom-sheet--browser-open"],
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        aria-label={t("sheet.close")}
        className={styles["bottom-sheet-backdrop"]}
        type="button"
        onClick={onClose}
      />
      <div aria-label={title} aria-modal="true" className={resolvedClassName} role="dialog">
        <div className={styles["bottom-sheet-handle"]} />
        <div className={styles["bottom-sheet-title"]}>{title}</div>
        {children}
      </div>
    </>
  );
}
