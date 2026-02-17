import { useEffect, useRef, useState } from 'react';

export default function StickyNote({
  object,
  isSelected,
  onSelect,
  onUpdate,
  onDragStart,
  onEditStateChange,
  zoom,
  remoteEntryPhase,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(object.text ?? '');
  const textRef = useRef(null);

  useEffect(() => {
    setDraftText(object.text ?? '');
  }, [object.text]);

  useEffect(() => {
    if (isEditing) {
      textRef.current?.focus();
      onEditStateChange?.(object.id, true);
    }
  }, [isEditing, object.id, onEditStateChange]);

  useEffect(() => {
    if (!isEditing) {
      onEditStateChange?.(object.id, false);
    }
  }, [isEditing, object.id, onEditStateChange]);

  const handleDoubleClick = (event) => {
    event.stopPropagation();
    setIsEditing(true);
  };

  const handlePointerDown = (event) => {
    onSelect(object.id);
    if (isEditing) {
      return;
    }
    onDragStart(object, event);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onUpdate(object.id, { text: draftText });
  };

  const handleKeyDown = (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.currentTarget.blur();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasteText = event.clipboardData.getData('text/plain');
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const next = `${draftText.slice(0, start)}${pasteText}${draftText.slice(end)}`;
    setDraftText(next);
  };

  const handleTextPointerDown = (event) => {
    event.stopPropagation();
  };

  const cursor = isEditing ? 'text' : isSelected ? 'grabbing' : 'grab';
  const isEntering = remoteEntryPhase === 'initial';
  const isHighlighted = remoteEntryPhase === 'active';

  return (
    <div
      data-testid="sticky-note"
      data-object-id={object.id}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      style={{
        position: 'absolute',
        left: object.x,
        top: object.y,
        width: object.width ?? 200,
        height: object.height ?? 150,
        background: object.color,
        border: '2px solid rgba(0,0,0,0.1)',
        borderRadius: 6,
        padding: 12,
        boxSizing: 'border-box',
        overflowWrap: 'break-word',
        zIndex: object.zIndex,
        cursor,
        userSelect: isEditing ? 'text' : 'none',
        opacity: isEntering ? 0 : 1,
        transition: 'opacity 300ms ease, box-shadow 300ms ease',
        boxShadow: isHighlighted ? '0 0 0 4px rgba(59, 130, 246, 0.35)' : 'none',
        overflow: 'hidden',
      }}
    >
      {isEditing ? (
        <textarea
          ref={textRef}
          data-testid="sticky-editor"
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onPointerDown={handleTextPointerDown}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            resize: 'none',
            background: 'transparent',
            font: 'inherit',
            color: '#1f2937',
          }}
        />
      ) : (
        <div style={{ height: '100%', overflow: 'auto' }}>{object.text}</div>
      )}
    </div>
  );
}
