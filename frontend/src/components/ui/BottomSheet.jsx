export default function BottomSheet({ open, onClose, title, children }) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button aria-label="Close sheet" className="bottom-sheet-backdrop" type="button" onClick={onClose} />
      <div aria-modal="true" className="bottom-sheet" role="dialog">
        <div className="bottom-sheet-handle" />
        <div className="bottom-sheet-title">{title}</div>
        {children}
      </div>
    </>
  );
}
