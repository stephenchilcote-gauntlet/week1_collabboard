import { OBJECT_COLORS, SELECTION_COLOR } from '../utils/colors.js';

export default function ColorPalette({ selectedObject, onChangeColor }) {
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
    >
      {OBJECT_COLORS.map((color) => {
        const isActive = color === selectedObject.color;
        return (
          <button
            key={color}
            type="button"
            data-testid="color-swatch"
            onClick={() => onChangeColor(selectedObject.id, color)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: isActive ? `2px solid ${SELECTION_COLOR}` : '2px solid transparent',
              background: color,
              cursor: 'pointer',
            }}
            aria-label={`Change color to ${color}`}
          />
        );
      })}
    </div>
  );
}
