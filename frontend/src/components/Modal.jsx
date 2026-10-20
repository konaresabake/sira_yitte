export default function Modal({ onClose, children }) {
  return (
    <div className="mod" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbox" role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}
