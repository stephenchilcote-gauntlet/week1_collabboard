import { useCallback, useRef, useState } from 'react';
import { screenToBoard } from '../utils/coordinates.js';
import { throttle } from '../utils/throttle.js';

export const isClickThreshold = (dx, dy) => Math.hypot(dx, dy) < 5;

export const useDrag = (viewport, updateObject, onDragStateChange) => {
  const [draggingId, setDraggingId] = useState(null);
  const dragAnchor = useRef({ x: 0, y: 0 });
  const startPointer = useRef({ x: 0, y: 0 });
  const updateObjectRef = useRef(updateObject);
  updateObjectRef.current = updateObject;
  const multiUpdateRef = useRef(null);
  const lineDragRef = useRef(null);
  const throttledUpdate = useRef(throttle((...args) => updateObjectRef.current(...args), 50));
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const updateDraggingId = useCallback((nextId) => {
    setDraggingId(nextId);
    onDragStateChange?.(nextId);
  }, [onDragStateChange]);

  const handleDragStart = useCallback((object, containerX, containerY, selectedObjects = null) => {
    updateDraggingId(object.id);
    startPointer.current = { x: containerX, y: containerY };
    const vp = viewportRef.current;
    const point = screenToBoard(containerX, containerY, vp.panX, vp.panY, vp.zoom);
    if (typeof object.x1 === 'number' && typeof object.y1 === 'number') {
      lineDragRef.current = {
        startPoint: point,
        x1: object.x1,
        y1: object.y1,
        x2: object.x2,
        y2: object.y2,
      };
    } else {
      lineDragRef.current = null;
      dragAnchor.current = { x: point.x - object.x, y: point.y - object.y };
    }
    if (selectedObjects) {
      const throttles = {};
      selectedObjects.forEach((item) => {
        throttles[item.id] = throttle((...args) => updateObjectRef.current(...args), 50);
      });
      multiUpdateRef.current = {
        startPoint: point,
        throttles,
        items: selectedObjects.map((item) => ({
          id: item.id,
          x: item.x,
          y: item.y,
          x1: item.x1,
          y1: item.y1,
          x2: item.x2,
          y2: item.y2,
        })),
      };
    } else {
      multiUpdateRef.current = null;
    }
    
  }, [updateDraggingId]);

  const handleDragMove = useCallback((containerX, containerY) => {
    if (!draggingId) {
      return;
    }
    const vp = viewportRef.current;
    const point = screenToBoard(containerX, containerY, vp.panX, vp.panY, vp.zoom);
    if (multiUpdateRef.current) {
      const dx = point.x - multiUpdateRef.current.startPoint.x;
      const dy = point.y - multiUpdateRef.current.startPoint.y;
      const { throttles } = multiUpdateRef.current;
      multiUpdateRef.current.items.forEach((item) => {
        const itemThrottle = throttles[item.id] ?? throttledUpdate.current;
        if (typeof item.x1 === 'number' && typeof item.y1 === 'number') {
          itemThrottle(item.id, {
            x1: item.x1 + dx,
            y1: item.y1 + dy,
            x2: item.x2 + dx,
            y2: item.y2 + dy,
          });
        } else {
          itemThrottle(item.id, {
            x: item.x + dx,
            y: item.y + dy,
          });
        }
      });
      return;
    }
    if (lineDragRef.current) {
      const dx = point.x - lineDragRef.current.startPoint.x;
      const dy = point.y - lineDragRef.current.startPoint.y;
      throttledUpdate.current(draggingId, {
        x1: lineDragRef.current.x1 + dx,
        y1: lineDragRef.current.y1 + dy,
        x2: lineDragRef.current.x2 + dx,
        y2: lineDragRef.current.y2 + dy,
      });
      return;
    }
    const next = {
      x: point.x - dragAnchor.current.x,
      y: point.y - dragAnchor.current.y,
    };
    if (multiUpdateRef.current) {
      multiUpdateRef.current.offsets.forEach((item) => {
        throttledUpdate.current(item.id, {
          x: next.x + item.dx,
          y: next.y + item.dy,
        });
      });
      return;
    }
    throttledUpdate.current(draggingId, next);
  }, [draggingId]);

  const handleDragEnd = useCallback((containerX, containerY) => {
    if (!draggingId) {
      return;
    }
    const dx = containerX - startPointer.current.x;
    const dy = containerY - startPointer.current.y;
    if (!isClickThreshold(dx, dy)) {
      if (multiUpdateRef.current?.throttles) {
        Object.values(multiUpdateRef.current.throttles).forEach((t) => t.flush?.());
      } else {
        throttledUpdate.current.flush?.();
      }
    }
    updateDraggingId(null);
    multiUpdateRef.current = null;
    lineDragRef.current = null;
  }, [draggingId, updateDraggingId]);

  return {
    draggingId,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
};
