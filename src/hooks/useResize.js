import { useCallback, useRef, useState } from 'react';
import { screenToBoard } from '../utils/coordinates.js';
import { throttle } from '../utils/throttle.js';

const MIN_SIZE = 20;

export const clampResize = (bounds, handle, dx, dy, options = {}) => {
  const { keepAspect = false, symmetric = false } = options;
  const aspect = bounds.width / bounds.height || 1;

  let left = bounds.x;
  let top = bounds.y;
  let right = bounds.x + bounds.width;
  let bottom = bounds.y + bounds.height;

  const moveW = handle.includes('w');
  const moveE = handle.includes('e');
  const moveN = handle.includes('n');
  const moveS = handle.includes('s');
  const isCorner = (moveW || moveE) && (moveN || moveS);

  // Apply raw deltas to the edges the handle controls
  // For symmetric mode (circles), edge handles grow both sides equally from center
  if (symmetric && !isCorner) {
    if (moveW) { left += dx; right -= dx; }
    if (moveE) { right += dx; left -= dx; }
    if (moveN) { top += dy; bottom -= dy; }
    if (moveS) { bottom += dy; top -= dy; }
  } else {
    if (moveW) left += dx;
    if (moveE) right += dx;
    if (moveN) top += dy;
    if (moveS) bottom += dy;
  }

  let width = right - left;
  let height = bottom - top;

  // Prevent inversion
  if (width < MIN_SIZE) {
    if (moveW && !moveE) left = right - MIN_SIZE;
    else right = left + MIN_SIZE;
    width = right - left;
  }
  if (height < MIN_SIZE) {
    if (moveN && !moveS) top = bottom - MIN_SIZE;
    else bottom = top + MIN_SIZE;
    height = bottom - top;
  }

  // Aspect-ratio lock (corners only — edge handles allow free resize)
  if (keepAspect && isCorner) {
    const driveX = Math.abs(dx) >= Math.abs(dy * aspect);
    if (driveX) {
      width = Math.max(MIN_SIZE, right - left);
      height = width / aspect;
      if (moveN) top = bottom - height;
      else bottom = top + height;
    } else {
      height = Math.max(MIN_SIZE, bottom - top);
      width = height * aspect;
      if (moveW) left = right - width;
      else right = left + width;
    }
  }

  // Final min-size clamp
  width = right - left;
  height = bottom - top;
  if (width < MIN_SIZE) right = left + MIN_SIZE;
  if (height < MIN_SIZE) bottom = top + MIN_SIZE;

  return { x: left, y: top, width: right - left, height: bottom - top };
};

export const useResize = (viewport, updateObject, onResizeStateChange) => {
  const [resizingId, setResizingId] = useState(null);
  const groupRef = useRef(null);
  const keepAspectRef = useRef(false);
  const symmetricRef = useRef(false);
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
    symmetricRef.current = Boolean(options.symmetric);
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
    const next = clampResize(initialBounds.current, handleRef.current, dx, dy, { keepAspect: keepAspectRef.current, symmetric: symmetricRef.current });
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
