import { useEffect, useState } from 'react';

export default function Toolbar({
  onCreateSticky,
  onCreateRectangle,
  onCreateCircle,
  onCreateLine,
  onCreateText,
  onCreateFrame,
  onEnterConnectorMode,
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
      if (event.key === 's' || event.key === 'S') {
        onCreateSticky();
        return;
      }
      if (event.key === 'r' || event.key === 'R') {
        onCreateRectangle();
        return;
      }
      if (event.key === 'c' || event.key === 'C') {
        onCreateCircle?.();
        return;
      }
      if (event.key === 'l' || event.key === 'L') {
        onCreateLine?.();
        return;
      }
      if (event.key === 't' || event.key === 'T') {
        onCreateText?.();
        return;
      }
      if (event.key === 'f' || event.key === 'F') {
        onCreateFrame?.();
        return;
      }
      if (event.key === 'k' || event.key === 'K') {
        onEnterConnectorMode?.();
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
  }, [
    interactionMode,
    onCreateSticky,
    onCreateRectangle,
    onCreateCircle,
    onCreateLine,
    onCreateText,
    onCreateFrame,
    onEnterConnectorMode,
    onDeleteSelected,
    selectedId,
  ]);

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
        title="Add sticky note (S)"
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
        title="Add rectangle (R)"
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
      <button
        type="button"
        onClick={onCreateCircle}
        title="Add circle (C)"
        onMouseEnter={() => setHoveredButton('circle')}
        onMouseLeave={() => setHoveredButton(null)}
        style={{
          cursor: 'pointer',
          background: hoveredButton === 'circle' ? 'rgba(0,0,0,0.08)' : 'transparent',
          borderRadius: 8,
          transition: 'background 0.15s',
        }}
      >
        Circle
      </button>
      <button
        type="button"
        onClick={onCreateLine}
        title="Add line (L)"
        onMouseEnter={() => setHoveredButton('line')}
        onMouseLeave={() => setHoveredButton(null)}
        style={{
          cursor: 'pointer',
          background: hoveredButton === 'line' ? 'rgba(0,0,0,0.08)' : 'transparent',
          borderRadius: 8,
          transition: 'background 0.15s',
        }}
      >
        Line
      </button>
      <button
        type="button"
        onClick={onCreateText}
        title="Add text (T)"
        onMouseEnter={() => setHoveredButton('text')}
        onMouseLeave={() => setHoveredButton(null)}
        style={{
          cursor: 'pointer',
          background: hoveredButton === 'text' ? 'rgba(0,0,0,0.08)' : 'transparent',
          borderRadius: 8,
          transition: 'background 0.15s',
        }}
      >
        Text
      </button>
      <button
        type="button"
        onClick={onCreateFrame}
        title="Add frame (F)"
        onMouseEnter={() => setHoveredButton('frame')}
        onMouseLeave={() => setHoveredButton(null)}
        style={{
          cursor: 'pointer',
          background: hoveredButton === 'frame' ? 'rgba(0,0,0,0.08)' : 'transparent',
          borderRadius: 8,
          transition: 'background 0.15s',
        }}
      >
        Frame
      </button>
      <button
        type="button"
        onClick={onEnterConnectorMode}
        title="Connector mode (K)"
        onMouseEnter={() => setHoveredButton('connector')}
        onMouseLeave={() => setHoveredButton(null)}
        style={{
          cursor: 'pointer',
          background: hoveredButton === 'connector' ? 'rgba(0,0,0,0.08)' : 'transparent',
          borderRadius: 8,
          transition: 'background 0.15s',
        }}
      >
        Connector
      </button>
    </div>
  );
}
