const getCenter = (object) => ({
  x: object.x + (object.width ?? 0) / 2,
  y: object.y + (object.height ?? 0) / 2,
});

export default function Connector({ connector, objects, onSelect }) {
  const source = objects?.[connector.fromId];
  const target = objects?.[connector.toId];

  if (!source || !target) {
    return null;
  }

  const start = getCenter(source);
  const end = getCenter(target);
  const stroke = connector.color ?? '#111827';
  const hasArrow = connector.style === 'arrow';

  return (
    <svg
      data-testid="connector"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: connector.zIndex ?? 0,
      }}
    >
      <defs>
        {hasArrow && (
          <marker
            data-testid="connector-arrow"
            id={`arrow-${connector.id}`}
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
          </marker>
        )}
      </defs>
      <line
        data-testid="connector-line"
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={stroke}
        strokeWidth={connector.strokeWidth ?? 2}
        markerEnd={hasArrow ? `url(#arrow-${connector.id})` : undefined}
        style={{ pointerEvents: 'none' }}
      />
      <line
        data-testid="connector-hitbox"
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="transparent"
        strokeWidth={14}
        onPointerDown={() => onSelect?.(connector.id)}
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
      />
    </svg>
  );
}
