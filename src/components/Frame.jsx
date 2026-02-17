import { useEffect, useRef, useState } from 'react';
import { isClickThreshold } from '../hooks/useDrag.js';

export default function Frame({
  object,
  isSelected,
  isDragging,
  lockedByOther,
  onSelect,
  onUpdate,
  onDragStart,
  onResizeStart,
  onEditStateChange,
  zoom,
  remoteEntryPhase,
  interactionMode,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(object.title ?? '');
  const inputRef = useRef(null);
  const prevEditingRef = useRef(false);
  const pendingDragRef = useRef(null);

  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(object.title ?? '');
    }
  }, [object.title, isEditing]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    if (isEditing !== prevEditingRef.current) {
      prevEditingRef.current = isEditing;
      onEditStateChange?.(object.id, isEditing);
    }
  }, [isEditing, object.id, onEditStateChange]);

  const cleanupPendingDrag = () => {
    if (pendingDragRef.current) {
      document.removeEventListener('pointermove', pendingDragRef.current.onMove);
      document.removeEventListener('pointerup', pendingDragRef.current.onUp);
      pendingDragRef.current = null;
    }
  };

  useEffect(() => cleanupPendingDrag, []);

  const handlePointerDown = (event) => {
    if (lockedByOther) {
      return;
    }
    onSelect?.(object.id, event);
    if (interactionMode === 'connecting' || isEditing) {
      return;
    }
    onDragStart?.(object, event);
  };

  const handleTitlePointerDown = (event) => {
    if (lockedByOther) {
      return;
    }
    onSelect?.(object.id, event);
    if (interactionMode === 'connecting' || isEditing) {
      return;
    }
    const startX = event.clientX;
    const startY = event.clientY;
    const origEvent = event.nativeEvent;

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!isClickThreshold(dx, dy)) {
        cleanupPendingDrag();
        onDragStart?.(object, origEvent);
      }
    };

    const onUp = () => {
      cleanupPendingDrag();
    };

    cleanupPendingDrag();
    pendingDragRef.current = { onMove, onUp };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
  };

  const handleTitleDoubleClick = (event) => {
    if (lockedByOther) {
      return;
    }
    event.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onUpdate?.(object.id, { title: draftTitle });
  };

  const handleKeyDown = (event) => {
    event.stopPropagation();
    if (event.key === 'Escape' || event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  const isEntering = remoteEntryPhase === 'initial';
  const isHighlighted = remoteEntryPhase === 'active';
  const cursor = lockedByOther ? 'not-allowed' : interactionMode === 'connecting' ? 'crosshair' : isDragging ? 'grabbing' : 'grab';

  return (
    <div
      data-testid="frame"
      data-object-id={object.id}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        left: object.x,
        top: object.y,
        width: object.width,
        height: object.height,
        zIndex: object.zIndex,
        boxSizing: 'border-box',
        opacity: isEntering ? 0 : lockedByOther ? 0.5 : 1,
        filter: lockedByOther ? 'grayscale(60%)' : 'none',
        transition: 'opacity 300ms ease, box-shadow 300ms ease, filter 300ms ease',
        transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
        transformOrigin: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* Background fill - click-through so children are interactive */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          background: object.color ? `${object.color}22` : 'rgba(148, 163, 184, 0.15)',
        }}
      />
      {/* Border edges - captures pointer events for selecting/dragging the frame */}
      {['top', 'bottom', 'left', 'right'].map((side) => (
        <div
          key={side}
          onPointerDown={handlePointerDown}
          style={{
            position: 'absolute',
            cursor,
            pointerEvents: 'auto',
            ...(side === 'top' && { top: 0, left: 0, right: 0, height: 6 }),
            ...(side === 'bottom' && { bottom: 0, left: 0, right: 0, height: 6 }),
            ...(side === 'left' && { top: 0, bottom: 0, left: 0, width: 6 }),
            ...(side === 'right' && { top: 0, bottom: 0, right: 0, width: 6 }),
          }}
        />
      ))}
      {/* Dashed border outline */}
      <div
        data-testid="frame-border"
        style={{
          position: 'absolute',
          inset: 0,
          border: `2px dashed ${object.color ? object.color : 'rgba(15, 23, 42, 0.35)'}`,
          borderRadius: 12,
          boxShadow: isHighlighted ? '0 0 0 3px rgba(59, 130, 246, 0.35)' : isHovered && !lockedByOther ? '0 0 0 2px rgba(59, 130, 246, 0.25)' : 'none',
          pointerEvents: 'none',
        }}
      />
      <div
        onPointerDown={handleTitlePointerDown}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '6px 10px',
          background: object.color ? `${object.color}33` : 'rgba(15, 23, 42, 0.08)',
          borderBottom: `1px dashed ${object.color ? object.color : 'rgba(15, 23, 42, 0.25)'}`,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          color: '#0f172a',
          cursor: isEditing ? 'text' : cursor,
          pointerEvents: 'auto',
        }}
        data-testid="frame-title"
        onDoubleClick={handleTitleDoubleClick}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            data-testid="frame-editor"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              fontWeight: 600,
              color: '#0f172a',
            }}
          />
        ) : (
          object.title
        )}
      </div>
    </div>
  );
}
