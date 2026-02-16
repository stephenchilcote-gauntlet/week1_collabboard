import { useCallback, useRef, useState } from 'react';
import { screenToBoard } from '../utils/coordinates.js';
import { throttle } from '../utils/throttle.js';

const MIN_SIZE = 20;

export const clampResize = (bounds, handle, dx, dy) => {
  let { x, y, width, height } = bounds;

  const applyX = handle.includes('w') || handle === 'w' || handle === 'nw' || handle === 'sw';
  const applyY = handle.includes('n') || handle === 'n' || handle === 'ne' || handle === 'nw';
  const applyRight = handle.includes('e') || handle === 'e' || handle === 'ne' || handle === 'se';
  const applyBottom = handle.includes('s') || handle === 's' || handle === 'se' || handle === 'sw';

  if (applyX) {
    x += dx;
    width -= dx;
  }
  if (applyRight) {
    width += dx;
  }
  if (applyY) {
    y += dy;
    height -= dy;
  }
  if (applyBottom) {
    height += dy;
  }

  if (width < MIN_SIZE) {
    if (applyX) {
      x -= MIN_SIZE - width;
    }
    width = MIN_SIZE;
  }
  if (height < MIN_SIZE) {
    if (applyY) {
      y -= MIN_SIZE - height;
    }
    height = MIN_SIZE;
  }

  return { x, y, width, height };
};

export const useResize = (viewport, updateObject, onResizeStateChange) => {
  const [resizingId, setResizingId] = useState(null);
  const initialBounds = useRef(null);
  const handleRef = useRef(null);
  const startPointer = useRef({ x: 0, y: 0 });
  const throttledUpdate = useRef(throttle(updateObject, 50));

  const updateResizingId = useCallback((nextId) => {
    setResizingId(nextId);
    onResizeStateChange?.(nextId);
  }, [onResizeStateChange]);

  const handleResizeStart = useCallback((object, handlePosition, containerX, containerY) => {
    updateResizingId(object.id);
    initialBounds.current = { x: object.x, y: object.y, width: object.width, height: object.height };
    handleRef.current = handlePosition;
    startPointer.current = { x: containerX, y: containerY };
  }, [updateResizingId]);

  const handleResizeMove = useCallback((containerX, containerY) => {
    if (!resizingId || !initialBounds.current || !handleRef.current) {
      return;
    }
    const start = screenToBoard(startPointer.current.x, startPointer.current.y, viewport.panX, viewport.panY, viewport.zoom);
    const current = screenToBoard(containerX, containerY, viewport.panX, viewport.panY, viewport.zoom);
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const next = clampResize(initialBounds.current, handleRef.current, dx, dy);
    throttledUpdate.current(resizingId, next);
  }, [resizingId, viewport]);

  const handleResizeEnd = useCallback(() => {
    if (!resizingId) {
      return;
    }
    throttledUpdate.current.flush?.();
    updateResizingId(null);
    initialBounds.current = null;
    handleRef.current = null;
  }, [resizingId, updateResizingId]);

  return {
    resizingId,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
  };
};
