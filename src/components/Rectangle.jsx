import { useState } from 'react';

export default function Rectangle({
  object,
  isSelected,
  isDragging,
  lockedByOther,
  onSelect,
  onUpdate,
  onDragStart,
  onResizeStart,
  zoom,
  remoteEntryPhase,
  interactionMode,
}) {
  const [isHovered, setIsHovered] = useState(false);

  const handlePointerDown = (event) => {
    if (lockedByOther) {
      return;
    }
    onSelect?.(object.id, event);
    if (interactionMode === 'connecting') {
      return;
    }
    onDragStart?.(object, event);
  };

  const isEntering = remoteEntryPhase === 'initial';
  const isHighlighted = remoteEntryPhase === 'active';
  const cursor = lockedByOther ? 'not-allowed' : interactionMode === 'connecting' ? 'crosshair' : isDragging ? 'grabbing' : 'grab';

  return (
    <div
      data-testid="rectangle"
      data-object-id={object.id}
      onPointerDown={handlePointerDown}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        left: object.x,
        top: object.y,
        width: object.width,
        height: object.height,
        background: object.color,
        border: '2px solid rgba(0,0,0,0.2)',
        boxSizing: 'border-box',
        zIndex: object.zIndex,
        cursor,
        opacity: isEntering ? 0 : lockedByOther ? 0.5 : 1,
        filter: lockedByOther ? 'grayscale(60%)' : 'none',
        transition: 'opacity 300ms ease, box-shadow 300ms ease, filter 300ms ease',
        boxShadow: isHighlighted ? '0 0 0 3px rgba(59, 130, 246, 0.35)' : isHovered && !lockedByOther ? '0 0 0 2px rgba(59, 130, 246, 0.25)' : 'none',
        transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
        transformOrigin: 'center',
      }}
    />
  );
}
