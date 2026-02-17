import { useEffect, useState } from 'react';
import { ERROR_COLOR, ERROR_BG, ERROR_TEXT } from '../utils/colors.js';

export default function ErrorBanner({ message, onDismiss }) {
  const [hovered, setHovered] = useState(false);
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
        background: ERROR_BG,
        border: `1px solid ${ERROR_COLOR}`,
        color: ERROR_TEXT,
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
      <button
        type="button"
        onClick={onDismiss}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          marginLeft: 12,
          cursor: 'pointer',
          background: hovered ? 'rgba(0,0,0,0.08)' : 'transparent',
          borderRadius: 8,
          transition: 'background 0.15s',
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
