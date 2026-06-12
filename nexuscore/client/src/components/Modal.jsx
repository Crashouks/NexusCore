export default function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div className="card" style={{
        width: wide ? 'min(700px, 95vw)' : 'min(480px, 95vw)',
        maxHeight: '90vh', overflow: 'auto', padding: 28,
      }} onClick={e => e.stopPropagation()}>
        {title && <h2 className="font-display" style={{ fontSize: 24, marginBottom: 20 }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
