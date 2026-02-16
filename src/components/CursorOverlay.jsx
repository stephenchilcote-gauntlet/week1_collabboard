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
          <div
            key={cursor.uid}
            style={{
              position: 'absolute',
              left: point.x,
              top: point.y,
              transform: 'translate(6px, 6px)',
              background: color,
              color: '#fff',
              padding: '2px 6px',
              borderRadius: 6,
              fontSize: 12,
              whiteSpace: 'nowrap',
            }}
          >
            {cursor.name}
          </div>
        );
      })}
    </div>
  );
}
