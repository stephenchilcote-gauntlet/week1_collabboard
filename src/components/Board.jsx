import { useEffect, useRef } from 'react';
import { useViewport } from '../hooks/useViewport.js';

export default function Board() {
  const boardRef = useRef(null);
  const {
    panX,
    panY,
    zoom,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    handleZoom,
  } = useViewport(boardRef);

  useEffect(() => {
    const boardEl = boardRef.current;
    if (!boardEl) {
      return undefined;
    }

    const handleWheel = (event) => {
      event.preventDefault();
      if (!event.ctrlKey) {
        return;
      }

      const rect = boardEl.getBoundingClientRect();
      handleZoom(event.deltaY, event.clientX - rect.left, event.clientY - rect.top);
    };

    boardEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => boardEl.removeEventListener('wheel', handleWheel);
  }, [handleZoom]);

  useEffect(() => {
    const handleWindowBlur = () => handlePanEnd();
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [handlePanEnd]);

  const handlePointerDown = (event) => {
    if (event.button !== 0) {
      return;
    }

    const objectHit = event.target.closest('[data-object-id]');
    const handleHit = event.target.closest('[data-resize-handle]');
    if (objectHit || handleHit) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    handlePanStart(event.clientX - rect.left, event.clientY - rect.top, event.pointerId);
  };

  const handlePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    handlePanMove(event.clientX - rect.left, event.clientY - rect.top);
  };

  const handlePointerEnd = (event) => {
    handlePanEnd(event.pointerId);
  };

  return (
    <div
      ref={boardRef}
      data-testid="board-outer"
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        background: '#f0f0f0',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div
        data-testid="board-inner"
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
          transformOrigin: '0 0',
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
    </div>
  );
}
