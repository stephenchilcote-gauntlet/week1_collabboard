import { useEffect, useRef, useState } from 'react';
import { isClickThreshold } from '../hooks/useDrag.js';

export default function StickyNote({
  object,
  isSelected,
  isDragging,
  lockedByOther,
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
  const pendingDragRef = useRef(null);

  useEffect(() => {
    if (!isEditing) {
      setDraftText(object.text ?? '');
    }
  }, [object.text, isEditing]);

  const prevEditingRef = useRef(false);
  useEffect(() => {
    if (isEditing) {
      textRef.current?.focus();
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

  const handleEnterEdit = (event) => {
    if (lockedByOther) {
      return;
    }
    event.stopPropagation();
    setIsEditing(true);
  };

  const handlePointerDown = (event) => {
    if (lockedByOther) {
      return;
    }
    onSelect(object.id);
    if (isEditing) {
      return;
    }
    if (!isSelected) {
      onDragStart(object, event);
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
        onDragStart(object, origEvent);
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
    const pos = start + pasteText.length;
    requestAnimationFrame(() => {
      target.setSelectionRange(pos, pos);
    });
  };

  const handleTextPointerDown = (event) => {
    event.stopPropagation();
  };

  const cursor = lockedByOther ? 'not-allowed' : isEditing ? 'text' : isDragging ? 'grabbing' : 'grab';
  const isEntering = remoteEntryPhase === 'initial';
  const isHighlighted = remoteEntryPhase === 'active';

  return (
    <div
      data-testid="sticky-note"
      data-object-id={object.id}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleEnterEdit}
      onClick={handleEnterEdit}
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
        opacity: isEntering ? 0 : lockedByOther ? 0.5 : 1,
        filter: lockedByOther ? 'grayscale(60%)' : 'none',
        transition: 'opacity 300ms ease, box-shadow 300ms ease, filter 300ms ease',
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
