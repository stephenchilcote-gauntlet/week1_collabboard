import { useCallback, useRef, useState } from 'react';
import { screenToBoard } from '../utils/coordinates.js';
import { throttle } from '../utils/throttle.js';

const MIN_SIZE = 20;

export const clampResize = (bounds, handle, dx, dy, options = {}) => {
  let { x, y, width, height } = bounds;
  const { keepAspect = false } = options;
  const aspect = width / height || 1;

  const applyX = handle.includes('w') || handle === 'w' || handle === 'nw' || handle === 'sw';
  const applyY = handle.includes('n') || handle === 'n' || handle === 'ne' || handle === 'nw';
  const applyRight = handle.includes('e') || handle === 'e' || handle === 'ne' || handle === 'se';
  const applyBottom = handle.includes('s') || handle === 's' || handle === 'se' || handle === 'sw';

  if (keepAspect && (applyX || applyRight || applyY || applyBottom)) {
    const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    if (applyX) {
      x += delta;
      width -= delta;
    }
    if (applyRight) {
      width += delta;
    }
    if (applyY) {
      y += delta;
      height -= delta;
    }
    if (applyBottom) {
      height += delta;
    }
    if (width / height > aspect) {
      width = height * aspect;
    } else {
      height = width / aspect;
    }
  } else {
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
  const groupRef = useRef(null);
  const keepAspectRef = useRef(false);
  const initialBounds = useRef(null);
  const handleRef = useRef(null);
  const startPointer = useRef({ x: 0, y: 0 });
  const updateObjectRef = useRef(updateObject);
  updateObjectRef.current = updateObject;
  const throttledUpdate = useRef(throttle((...args) => updateObjectRef.current(...args), 50));
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const updateResizingId = useCallback((nextId) => {
    setResizingId(nextId);
    onResizeStateChange?.(nextId);
  }, [onResizeStateChange]);

  const handleResizeStart = useCallback((object, handlePosition, containerX, containerY, options = {}) => {
    updateResizingId(object.id);
    initialBounds.current = { x: object.x, y: object.y, width: object.width, height: object.height };
    handleRef.current = handlePosition;
    keepAspectRef.current = Boolean(options.keepAspect);
    startPointer.current = { x: containerX, y: containerY };
    if (options.groupBounds && options.groupItems) {
      groupRef.current = {
        bounds: options.groupBounds,
        items: options.groupItems,
      };
    } else {
      groupRef.current = null;
    }
  }, [updateResizingId]);

  const handleResizeMove = useCallback((containerX, containerY) => {
    if (!resizingId || !initialBounds.current || !handleRef.current) {
      return;
    }
    const vp = viewportRef.current;
    const start = screenToBoard(startPointer.current.x, startPointer.current.y, vp.panX, vp.panY, vp.zoom);
    const current = screenToBoard(containerX, containerY, vp.panX, vp.panY, vp.zoom);
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const next = clampResize(initialBounds.current, handleRef.current, dx, dy, { keepAspect: keepAspectRef.current });
    if (groupRef.current) {
      const { bounds, items } = groupRef.current;
      const scaleX = next.width / bounds.width;
      const scaleY = next.height / bounds.height;
      items.forEach((item) => {
        const offsetX = item.x - bounds.x;
        const offsetY = item.y - bounds.y;
        throttledUpdate.current(item.id, {
          x: next.x + offsetX * scaleX,
          y: next.y + offsetY * scaleY,
          width: item.width * scaleX,
          height: item.height * scaleY,
        });
      });
      return;
    }
    throttledUpdate.current(resizingId, next);
  }, [resizingId]);

  const handleResizeEnd = useCallback(() => {
    if (!resizingId) {
      return;
    }
    throttledUpdate.current.flush?.();
    updateResizingId(null);
    initialBounds.current = null;
    handleRef.current = null;
    groupRef.current = null;
  }, [resizingId, updateResizingId]);

  return {
    resizingId,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
  };
};
