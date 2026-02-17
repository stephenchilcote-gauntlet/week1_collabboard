import { useEffect, useRef, useState } from 'react';

export default function TextElement({
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
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(object.text ?? '');
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isEditing) {
      setDraftText(object.text ?? '');
    }
  }, [object.text, isEditing]);

  const prevEditingRef = useRef(false);
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
    if (isEditing !== prevEditingRef.current) {
      prevEditingRef.current = isEditing;
      onEditStateChange?.(object.id, isEditing);
    }
  }, [isEditing, object.id, onEditStateChange]);

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

  const handleDoubleClick = (event) => {
    if (lockedByOther) {
      return;
    }
    event.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onUpdate?.(object.id, { text: draftText });
  };

  const handleKeyDown = (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.currentTarget.blur();
    }
  };

  const isEntering = remoteEntryPhase === 'initial';
  const isHighlighted = remoteEntryPhase === 'active';
  const cursor = lockedByOther ? 'not-allowed' : interactionMode === 'connecting' ? 'crosshair' : isEditing ? 'text' : isDragging ? 'grabbing' : 'grab';

  return (
    <div
      data-testid="text-element"
      data-object-id={object.id}
      onPointerDown={handlePointerDown}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}
      style={{
        position: 'absolute',
        left: object.x,
        top: object.y,
        width: object.width ?? 160,
        height: object.height ?? 40,
        background: 'transparent',
        zIndex: object.zIndex,
        cursor,
        opacity: isEntering ? 0 : lockedByOther ? 0.5 : 1,
        filter: lockedByOther ? 'grayscale(60%)' : 'none',
        transition: 'opacity 300ms ease, box-shadow 300ms ease, filter 300ms ease',
        boxShadow: isHighlighted ? '0 0 0 3px rgba(59, 130, 246, 0.35)' : isHovered && !lockedByOther ? '0 0 0 2px rgba(59, 130, 246, 0.25)' : 'none',
        transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
        transformOrigin: 'center',
      }}
    >
      {isEditing ? (
        <textarea
          ref={inputRef}
          data-testid="text-editor"
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            resize: 'none',
            background: 'transparent',
            fontSize: object.fontSize ?? 16,
            color: object.color ?? '#111827',
          }}
        />
      ) : (
        <div style={{
          whiteSpace: 'pre-wrap',
          fontSize: object.fontSize ?? 16,
          color: object.color ?? '#111827',
        }}>
          {object.text}
        </div>
      )}
    </div>
  );
}
