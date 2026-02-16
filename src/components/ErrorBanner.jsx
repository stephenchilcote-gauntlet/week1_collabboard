import { useEffect } from 'react';

export default function ErrorBanner({ message, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 48,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#fee2e2',
        border: '1px solid #ef4444',
        color: '#991b1b',
        padding: '10px 16px',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        zIndex: 220,
      }}
    >
      <span aria-hidden="true">✕</span>
      <span>{message}</span>
      <button type="button" onClick={onDismiss} style={{ marginLeft: 12, cursor: 'pointer' }}>
        Dismiss
      </button>
    </div>
  );
}
