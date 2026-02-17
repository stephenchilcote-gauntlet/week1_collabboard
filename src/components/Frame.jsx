import { useEffect, useRef, useState } from 'react';

export default function Frame({
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
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(object.title ?? '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(object.title ?? '');
    }
  }, [object.title, isEditing]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

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
    if (event.key === 'Escape') {
      event.currentTarget.blur();
    }
  };

  const isEntering = remoteEntryPhase === 'initial';
  const isHighlighted = remoteEntryPhase === 'active';
  const cursor = lockedByOther ? 'not-allowed' : isDragging ? 'grabbing' : 'grab';

  return (
    <div
      data-testid="frame"
      data-object-id={object.id}
      onPointerDown={handlePointerDown}
      style={{
        position: 'absolute',
        left: object.x,
        top: object.y,
        width: object.width,
        height: object.height,
        border: '2px dashed rgba(15, 23, 42, 0.35)',
        borderRadius: 12,
        background: 'rgba(148, 163, 184, 0.15)',
        zIndex: object.zIndex,
        cursor,
        boxSizing: 'border-box',
        opacity: isEntering ? 0 : lockedByOther ? 0.5 : 1,
        filter: lockedByOther ? 'grayscale(60%)' : 'none',
        transition: 'opacity 300ms ease, box-shadow 300ms ease, filter 300ms ease',
        boxShadow: isHighlighted ? '0 0 0 3px rgba(59, 130, 246, 0.35)' : 'none',
        transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
        transformOrigin: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '6px 10px',
          background: 'rgba(15, 23, 42, 0.08)',
          borderBottom: '1px dashed rgba(15, 23, 42, 0.25)',
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          color: '#0f172a',
          cursor: isEditing ? 'text' : cursor,
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
