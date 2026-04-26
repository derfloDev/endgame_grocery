export default function BottomSheet({ open, onClose, title, className = "", children }) {
  if (!open) {
    return null;
  }

  const resolvedClassName = ["bottom-sheet", className].filter(Boolean).join(" ");

  return (
    <>
      <button aria-label="Close sheet" className="bottom-sheet-backdrop" type="button" onClick={onClose} />
      <div aria-label={title} aria-modal="true" className={resolvedClassName} role="dialog">
        <div className="bottom-sheet-handle" />
        <div className="bottom-sheet-title">{title}</div>
        {children}
      </div>
    </>
  );
}
