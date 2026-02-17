import { useEffect, useState } from 'react';

export default function Toolbar({
  onCreateSticky,
  onCreateRectangle,
  onDeleteSelected,
  selectedId,
  interactionMode,
}) {
  const [hoveredButton, setHoveredButton] = useState(null);
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (interactionMode === 'editing') {
        return;
      }
      if (!selectedId) {
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        onDeleteSelected(selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [interactionMode, onDeleteSelected, selectedId]);

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        background: '#e8e8e8',
        padding: '12px 10px',
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        zIndex: 160,
      }}
    >
      <button
        type="button"
        onClick={onCreateSticky}
        title="Add sticky note"
        onMouseEnter={() => setHoveredButton('sticky')}
        onMouseLeave={() => setHoveredButton(null)}
        style={{
          cursor: 'pointer',
          background: hoveredButton === 'sticky' ? 'rgba(0,0,0,0.08)' : 'transparent',
          borderRadius: 8,
          transition: 'background 0.15s',
        }}
      >
        Sticky Note
      </button>
      <button
        type="button"
        onClick={onCreateRectangle}
        title="Add rectangle"
        onMouseEnter={() => setHoveredButton('rectangle')}
        onMouseLeave={() => setHoveredButton(null)}
        style={{
          cursor: 'pointer',
          background: hoveredButton === 'rectangle' ? 'rgba(0,0,0,0.08)' : 'transparent',
          borderRadius: 8,
          transition: 'background 0.15s',
        }}
      >
        Rectangle
      </button>
    </div>
  );
}
