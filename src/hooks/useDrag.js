import { useCallback, useRef, useState } from 'react';
import { screenToBoard } from '../utils/coordinates.js';
import { throttle } from '../utils/throttle.js';

export const isClickThreshold = (dx, dy) => Math.hypot(dx, dy) < 5;

export const useDrag = (viewport, updateObject, selectObject, onDragStateChange) => {
  const [draggingId, setDraggingId] = useState(null);
  const dragAnchor = useRef({ x: 0, y: 0 });
  const startPointer = useRef({ x: 0, y: 0 });
  const throttledUpdate = useRef(throttle(updateObject, 50));

  const updateDraggingId = useCallback((nextId) => {
    setDraggingId(nextId);
    onDragStateChange?.(nextId);
  }, [onDragStateChange]);

  const handleDragStart = useCallback((object, containerX, containerY) => {
    updateDraggingId(object.id);
    startPointer.current = { x: containerX, y: containerY };
    const point = screenToBoard(containerX, containerY, viewport.panX, viewport.panY, viewport.zoom);
    dragAnchor.current = { x: point.x - object.x, y: point.y - object.y };
    selectObject?.(object.id);
  }, [selectObject, updateDraggingId, viewport]);

  const handleDragMove = useCallback((containerX, containerY) => {
    if (!draggingId) {
      return;
    }
    const point = screenToBoard(containerX, containerY, viewport.panX, viewport.panY, viewport.zoom);
    const next = {
      x: point.x - dragAnchor.current.x,
      y: point.y - dragAnchor.current.y,
    };
    throttledUpdate.current(draggingId, next);
  }, [draggingId, viewport]);

  const handleDragEnd = useCallback((containerX, containerY) => {
    if (!draggingId) {
      return;
    }
    const dx = containerX - startPointer.current.x;
    const dy = containerY - startPointer.current.y;
    if (!isClickThreshold(dx, dy)) {
      throttledUpdate.current.flush?.();
    }
    updateDraggingId(null);
  }, [draggingId, updateDraggingId]);

  return {
    draggingId,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
};
