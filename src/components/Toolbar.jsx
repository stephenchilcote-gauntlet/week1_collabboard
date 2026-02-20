import { useEffect, useState } from 'react';

const tools = [
  {
    id: 'sticky',
    label: 'Sticky',
    shortcut: 'S',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" />
        <polyline points="14 3 14 9 21 9" />
      </svg>
    ),
  },
  {
    id: 'rectangle',
    label: 'Rect',
    shortcut: 'R',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
      </svg>
    ),
  },
  {
    id: 'circle',
    label: 'Circle',
    shortcut: 'C',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    id: 'line',
    label: 'Line',
    shortcut: 'L',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <line x1="5" y1="19" x2="19" y2="5" />
      </svg>
    ),
  },
  {
    id: 'text',
    label: 'Text',
    shortcut: 'T',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="8" y1="20" x2="16" y2="20" />
      </svg>
    ),
  },
  {
    id: 'frame',
    label: 'Frame',
    shortcut: 'F',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="0" strokeDasharray="4 2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="3" x2="9" y2="21" />
      </svg>
    ),
  },
  {
    id: 'connector',
    label: 'Connect',
    shortcut: 'K',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="19" r="2.5" />
        <circle cx="19" cy="5" r="2.5" />
        <path d="M7.5 16.5L16.5 7.5" />
      </svg>
    ),
  },
];

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
  connectorMode,
  connectorFromId,
}) {
  const [hoveredButton, setHoveredButton] = useState(null);

  const actions = {
    sticky: onCreateSticky,
    rectangle: onCreateRectangle,
    circle: onCreateCircle,
    line: onCreateLine,
    text: onCreateText,
    frame: onCreateFrame,
    connector: onEnterConnectorMode,
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (interactionMode === 'editing') return;
      const keyMap = { s: 'sticky', r: 'rectangle', c: 'circle', l: 'line', t: 'text', f: 'frame', k: 'connector' };
      const tool = keyMap[event.key.toLowerCase()];
      if (tool) { actions[tool]?.(); return; }
      if (!selectedId) return;
      if (event.key === 'Delete' || event.key === 'Backspace') onDeleteSelected(selectedId);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    interactionMode, onCreateSticky, onCreateRectangle, onCreateCircle,
    onCreateLine, onCreateText, onCreateFrame, onEnterConnectorMode,
    onDeleteSelected, selectedId,
  ]);

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        background: '#ebebeb',
        padding: '6px',
        borderRadius: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        boxShadow: '0 2px 12px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)',
        zIndex: 160,
      }}
    >
      {tools.map((tool) => {
        const isActive = tool.id === 'connector' && connectorMode;
        const isHovered = hoveredButton === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={actions[tool.id]}
            title={`${tool.label} (${tool.shortcut})`}
            onMouseEnter={() => setHoveredButton(tool.id)}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '7px 8px',
              border: 'none',
              borderRadius: 10,
              background: isActive
                ? '#d0e0f0'
                : isHovered
                  ? 'rgba(0,0,0,0.07)'
                  : 'transparent',
              color: isActive ? '#2563eb' : '#4b5563',
              transition: 'background 0.15s ease',
              outline: isActive ? '1.5px solid #3b82f6' : 'none',
              outlineOffset: -1,
              minWidth: 50,
            }}
          >
            <span style={{ display: 'flex' }}>
              {tool.icon}
            </span>
            <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1, color: isActive ? '#2563eb' : '#6b7280' }}>
              {tool.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
