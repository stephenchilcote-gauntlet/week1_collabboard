import { useState } from 'react';
import { OBJECT_COLORS, SELECTION_COLOR } from '../utils/colors.js';

export default function ColorPalette({ selectedObject, onChangeColor }) {
  const [hoveredColor, setHoveredColor] = useState(null);

  if (!selectedObject) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: 8,
        background: '#f3f3f3',
        borderRadius: 12,
      }}
      data-testid="color-palette"
    >
      {OBJECT_COLORS.map((color) => {
        const isActive = color === selectedObject.color;
        const isHovered = hoveredColor === color;
        return (
          <button
            key={color}
            type="button"
            data-testid="color-swatch"
            onClick={() => onChangeColor(selectedObject.id, { color })}
            onMouseEnter={() => setHoveredColor(color)}
            onMouseLeave={() => setHoveredColor(null)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: isActive ? `2px solid ${SELECTION_COLOR}` : '2px solid transparent',
              background: color,
              cursor: 'pointer',
              transform: isHovered ? 'scale(1.25)' : 'scale(1)',
              transition: 'transform 0.1s ease',
            }}
            aria-label={`Change color to ${color}`}
          />
        );
      })}
    </div>
  );
}
