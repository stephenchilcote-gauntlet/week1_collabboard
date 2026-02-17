import { SELECTION_COLOR } from '../utils/colors.js';

const HANDLE_POSITIONS = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
];

const handleStyle = (position, size) => {
  const half = size / 2;
  const cursors = {
    nw: 'nwse-resize',
    se: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize',
  };
  const base = {
    position: 'absolute',
    width: `${size}px`,
    height: `${size}px`,
    background: '#fff',
    border: `1px solid ${SELECTION_COLOR}`,
    borderRadius: '50%',
    pointerEvents: 'auto',
    cursor: cursors[position] ?? 'default',
    transition: 'background 150ms ease, box-shadow 150ms ease',
  };

  const positions = {
    nw: { left: -half, top: -half },
    n: { left: '50%', top: -half, transform: 'translateX(-50%)' },
    ne: { right: -half, top: -half },
    e: { right: -half, top: '50%', transform: 'translateY(-50%)' },
    se: { right: -half, bottom: -half },
    s: { left: '50%', bottom: -half, transform: 'translateX(-50%)' },
    sw: { left: -half, bottom: -half },
    w: { left: -half, top: '50%', transform: 'translateY(-50%)' },
  };

  return { ...base, ...positions[position] };
};

export default function SelectionOverlay({ object, isResizable, zoom }) {
  const { x, y, width, height } = object;
  const handleSize = 8 / zoom;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        border: `2px solid ${SELECTION_COLOR}`,
        zIndex: (object.zIndex ?? 0) + 1,
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
      data-testid="selection-border"
    >
      {isResizable && HANDLE_POSITIONS.map((position) => (
        <div
          key={position}
          data-testid="resize-handle"
          data-resize-handle={position}
          style={handleStyle(position, handleSize)}
        />
      ))}
    </div>
  );
}
