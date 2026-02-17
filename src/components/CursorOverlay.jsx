import { boardToScreen } from '../utils/coordinates.js';
import { cursorColorFromUid } from '../utils/colors.js';

export default function CursorOverlay({ cursors, viewport }) {
  const { panX, panY, zoom, viewportWidth, viewportHeight } = viewport;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {Object.values(cursors).map((cursor) => {
        const point = boardToScreen(cursor.x, cursor.y, panX, panY, zoom);
        if (point.x < 0 || point.y < 0 || point.x > viewportWidth || point.y > viewportHeight) {
          return null;
        }
        const color = cursorColorFromUid(cursor.uid);
        return (
          <div key={cursor.uid} style={{ position: 'absolute', left: point.x, top: point.y, pointerEvents: 'none' }}>
            <svg
              width="12"
              height="16"
              viewBox="0 0 12 16"
              fill={color}
              style={{ display: 'block', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }}
            >
              <path d="M0 0 L0 12 L4 9 L7 15 L9 14 L6 8 L11 7 Z" />
            </svg>
            <span style={{
              position: 'absolute',
              left: 14,
              top: 8,
              background: color,
              color: '#fff',
              padding: '2px 6px',
              borderRadius: 6,
              fontSize: 12,
              whiteSpace: 'nowrap',
            }}>
              {cursor.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
