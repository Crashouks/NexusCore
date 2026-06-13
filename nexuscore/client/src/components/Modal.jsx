import { useEffect } from 'react';
import Icon from './Icon';

export default function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = false,
}) {
  useEffect(() => {
    if (!open || !closeOnEscape || !onClose) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  const handleBackdropClick = closeOnBackdrop ? onClose : undefined;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={handleBackdropClick}
    >
      <div
        className="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        style={{
          position: 'relative',
          width: wide ? 'min(700px, 95vw)' : 'min(480px, 95vw)',
          maxHeight: '90vh', overflow: 'auto', padding: 28,
        }}
        onClick={e => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 16, marginBottom: title ? 20 : 0,
          }}>
            {title ? (
              <h2 id="modal-title" className="font-display" style={{ fontSize: 24, margin: 0, flex: 1 }}>
                {title}
              </h2>
            ) : (
              <span style={{ flex: 1 }} />
            )}
            {showCloseButton && onClose && (
              <button
                type="button"
                className="icon-btn modal-close-btn"
                onClick={onClose}
                aria-label="Close"
                style={{ flexShrink: 0, marginTop: -4, marginRight: -4 }}
              >
                <Icon name="x" size={20} />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
