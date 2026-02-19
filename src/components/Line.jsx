import { useEffect, useRef, useState } from 'react';

const endpointStyle = (x, y, cursor, size = 10) => ({
  position: 'absolute',
  left: x - size / 2,
  top: y - size / 2,
  width: size,
  height: size,
  borderRadius: '50%',
  background: '#fff',
  border: '2px solid rgba(17, 24, 39, 0.6)',
  cursor,
  pointerEvents: 'auto',
  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
});

export default function Line({
  object,
  isSelected,
  isDragging,
  lockedByOther,
  onSelect,
  onUpdate,
  onDragStart,
  zoom,
  remoteEntryPhase,
  interactionMode,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [draggingEndpoint, setDraggingEndpoint] = useState(null);
  const startPointer = useRef({ x: 0, y: 0 });
  const startPoints = useRef({ x1: 0, y1: 0, x2: 0, y2: 0 });

  useEffect(() => {
    if (!draggingEndpoint) {
      return undefined;
    }

    const handleMove = (event) => {
      const dx = (event.clientX - startPointer.current.x) / (zoom || 1);
      const dy = (event.clientY - startPointer.current.y) / (zoom || 1);
      const next = { ...startPoints.current };
      if (draggingEndpoint === 'start') {
        next.x1 = startPoints.current.x1 + dx;
        next.y1 = startPoints.current.y1 + dy;
      } else {
        next.x2 = startPoints.current.x2 + dx;
        next.y2 = startPoints.current.y2 + dy;
      }
      onUpdate?.(object.id, next);
    };

    const handleUp = () => {
      setDraggingEndpoint(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [draggingEndpoint, object.id, onUpdate, zoom]);

  const handleBodyPointerDown = (event) => {
    if (lockedByOther) {
      return;
    }
    onSelect?.(object.id, event);
    if (interactionMode === 'connecting') {
      return;
    }
    event.stopPropagation();
    onDragStart?.(object, event);
  };

  const handleEndpointPointerDown = (endpoint) => (event) => {
    if (lockedByOther) {
      return;
    }
    event.stopPropagation();
    onSelect?.(object.id, event);
    if (interactionMode === 'connecting') {
      return;
    }
    startPointer.current = { x: event.clientX, y: event.clientY };
    startPoints.current = {
      x1: object.x1,
      y1: object.y1,
      x2: object.x2,
      y2: object.y2,
    };
    setDraggingEndpoint(endpoint);
  };

  const isEntering = remoteEntryPhase === 'initial';
  const isHighlighted = remoteEntryPhase === 'active';
  const cursor = lockedByOther ? 'not-allowed' : interactionMode === 'connecting' ? 'crosshair' : isDragging ? 'grabbing' : 'grab';
  const opacity = isEntering ? 0 : lockedByOther ? 0.5 : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: object.zIndex,
      }}
      data-object-id={object.id}
      data-line-wrapper
    >
      <svg
        data-testid="line-shape"
        data-object-id={object.id}
        data-line-wrapper
        width="100%"
        height="100%"
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
      >
        <line
          data-testid="line-hit-area"
          x1={object.x1}
          y1={object.y1}
          x2={object.x2}
          y2={object.y2}
          stroke="transparent"
          strokeWidth={Math.max(object.strokeWidth ?? 2, 14)}
          style={{
            pointerEvents: 'auto',
            cursor,
          }}
          onPointerDown={handleBodyPointerDown}
          onPointerEnter={() => setIsHovered(true)}
          onPointerLeave={() => setIsHovered(false)}
        />
        <line
          data-testid="line-body"
          x1={object.x1}
          y1={object.y1}
          x2={object.x2}
          y2={object.y2}
          stroke={object.color}
          strokeWidth={object.strokeWidth ?? 2}
          opacity={opacity}
          style={{
            pointerEvents: 'none',
            transition: 'opacity 300ms ease, filter 300ms ease',
            filter: lockedByOther ? 'grayscale(60%)' : 'none',
            strokeLinecap: 'round',
          }}
        />
        {isHovered && !lockedByOther && !isHighlighted && (
          <line
            x1={object.x1}
            y1={object.y1}
            x2={object.x2}
            y2={object.y2}
            stroke="rgba(59, 130, 246, 0.25)"
            strokeWidth={(object.strokeWidth ?? 2) + 6}
            style={{ pointerEvents: 'none' }}
          />
        )}
        {isHighlighted && (
          <line
            x1={object.x1}
            y1={object.y1}
            x2={object.x2}
            y2={object.y2}
            stroke="rgba(59, 130, 246, 0.45)"
            strokeWidth={(object.strokeWidth ?? 2) + 6}
            opacity={0.6}
            style={{ pointerEvents: 'none' }}
          />
        )}
      </svg>
      {isSelected && !lockedByOther && interactionMode !== 'connecting' && (
        <>
          <div
            data-testid="line-endpoint-start"
            style={endpointStyle(object.x1, object.y1, 'move', 10 / (zoom || 1))}
            onPointerDown={handleEndpointPointerDown('start')}
          />
          <div
            data-testid="line-endpoint-end"
            style={endpointStyle(object.x2, object.y2, 'move', 10 / (zoom || 1))}
            onPointerDown={handleEndpointPointerDown('end')}
          />
        </>
      )}
    </div>
  );
}
