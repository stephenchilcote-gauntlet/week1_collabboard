import { useCallback, useRef, useState } from 'react';
import { screenToBoard } from '../utils/coordinates.js';
import { throttle } from '../utils/throttle.js';

export const isClickThreshold = (dx, dy) => Math.hypot(dx, dy) < 5;

export const useDrag = (viewport, updateObject, selectObject, onDragStateChange) => {
  const [draggingId, setDraggingId] = useState(null);
  const dragAnchor = useRef({ x: 0, y: 0 });
  const startPointer = useRef({ x: 0, y: 0 });
  const updateObjectRef = useRef(updateObject);
  updateObjectRef.current = updateObject;
  const throttledUpdate = useRef(throttle((...args) => updateObjectRef.current(...args), 50));
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const updateDraggingId = useCallback((nextId) => {
    setDraggingId(nextId);
    onDragStateChange?.(nextId);
  }, [onDragStateChange]);

  const handleDragStart = useCallback((object, containerX, containerY) => {
    updateDraggingId(object.id);
    startPointer.current = { x: containerX, y: containerY };
    const vp = viewportRef.current;
    const point = screenToBoard(containerX, containerY, vp.panX, vp.panY, vp.zoom);
    dragAnchor.current = { x: point.x - object.x, y: point.y - object.y };
    selectObject?.(object.id);
  }, [selectObject, updateDraggingId]);

  const handleDragMove = useCallback((containerX, containerY) => {
    if (!draggingId) {
      return;
    }
    const vp = viewportRef.current;
    const point = screenToBoard(containerX, containerY, vp.panX, vp.panY, vp.zoom);
    const next = {
      x: point.x - dragAnchor.current.x,
      y: point.y - dragAnchor.current.y,
    };
    throttledUpdate.current(draggingId, next);
  }, [draggingId]);

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
