import { useTranslation } from "react-i18next";
import type { ReactElement, ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  className?: string;
  children?: ReactNode;
}

export default function BottomSheet({
  open,
  onClose,
  title,
  className = "",
  children
}: BottomSheetProps): ReactElement | null {
  const { t } = useTranslation();

  if (!open) {
    return null;
  }

  const resolvedClassName = ["bottom-sheet", className].filter(Boolean).join(" ");

  return (
    <>
      <button aria-label={t("sheet.close")} className="bottom-sheet-backdrop" type="button" onClick={onClose} />
      <div aria-label={title} aria-modal="true" className={resolvedClassName} role="dialog">
        <div className="bottom-sheet-handle" />
        <div className="bottom-sheet-title">{title}</div>
        {children}
      </div>
    </>
  );
}
