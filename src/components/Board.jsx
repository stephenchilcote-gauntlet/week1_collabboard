import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StickyNote from './StickyNote.jsx';
import Rectangle from './Rectangle.jsx';
import Circle from './Circle.jsx';
import Line from './Line.jsx';
import TextElement from './TextElement.jsx';
import Frame from './Frame.jsx';
import Connector from './Connector.jsx';
import EmbedObject from './EmbedObject.jsx';
import SelectionOverlay from './SelectionOverlay.jsx';
import SelectionMarquee from './SelectionMarquee.jsx';
import { boardToScreen } from '../utils/coordinates.js';
import { isClickThreshold } from '../hooks/useDrag.js';

const REMOTE_ENTRY_DURATION_MS = 350;
const OFFSCREEN_TOAST_DURATION_MS = 3000;
const RESIZE_CURSORS = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
};

const emptySet = new Set();

const computeNextSelection = (currentSelectedIds, objectId, shiftKey) => {
  if (shiftKey) {
    const next = new Set(currentSelectedIds);
    if (next.has(objectId)) {
      next.delete(objectId);
    } else {
      next.add(objectId);
    }
    return next;
  }
  if (currentSelectedIds.has(objectId)) {
    return currentSelectedIds;
  }
  return new Set([objectId]);
};

export default function Board({
  boardRef,
  viewport,
  objects,
  objectsLoaded,
  user,
  localCreatedIds,
  selectedId,
  selectedIds,
  draggingId,
  lockedObjectIds,
  onSetSelection,
  onClearSelection,
  onUpdateObject,
  onEditingChange,
  onDragStart,
  onDragMove,
  onDragEnd,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  onConnectorCandidate,
  connectorMode,
  marqueeBounds,
  selectionBounds,
  onMarqueeStart,
  onMarqueeMove,
  onMarqueeEnd,
  onRotationStart,
  onRotationMove,
  onRotationEnd,
  onCursorMove,
}) {
  const fallbackRef = useRef(null);
  const resolvedRef = boardRef ?? fallbackRef;
  const localCreatedSet = localCreatedIds ?? emptySet;
  const {
    panX,
    panY,
    zoom,
    viewportWidth,
    viewportHeight,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    handleZoom,
    isPanning,
  } = viewport;
  const [remoteEntryPhases, setRemoteEntryPhases] = useState({});
  const entryTimeoutsRef = useRef(new Map());
  const entryInitializedRef = useRef(false);
  const prevEntryObjectsRef = useRef({});
  const [notifications, setNotifications] = useState([]);
  const notificationTimeoutsRef = useRef(new Map());
  const notificationInitializedRef = useRef(false);
  const prevNotificationObjectsRef = useRef({});
  const lastNotificationRef = useRef({});
  const pointerCaptureRef = useRef(null);
  const pendingDragRef = useRef(null);
  const [activeResizeCursor, setActiveResizeCursor] = useState('');

  const sortedObjects = useMemo(() => Object.values(objects ?? {}).sort((a, b) => (
    (a.zIndex ?? 0) - (b.zIndex ?? 0)
  )), [objects]);
  const selectedObject = selectedId ? objects?.[selectedId] : null;
  const selectionSet = selectedIds ?? emptySet;

  const triggerRemoteEntry = useCallback((objectId) => {
    setRemoteEntryPhases((prev) => ({
      ...prev,
      [objectId]: 'initial',
    }));

    const existing = entryTimeoutsRef.current.get(objectId);
    if (existing) {
      clearTimeout(existing.activate);
      clearTimeout(existing.cleanup);
    }

    const activate = setTimeout(() => {
      setRemoteEntryPhases((prev) => {
        if (!prev[objectId]) {
          return prev;
        }
        return {
          ...prev,
          [objectId]: 'active',
        };
      });
    }, 0);

    const cleanup = setTimeout(() => {
      setRemoteEntryPhases((prev) => {
        if (!prev[objectId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[objectId];
        return next;
      });
      entryTimeoutsRef.current.delete(objectId);
    }, REMOTE_ENTRY_DURATION_MS);

    entryTimeoutsRef.current.set(objectId, { activate, cleanup });
  }, []);

  const pushNotification = useCallback((message) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setNotifications((prev) => [...prev, { id, message }]);
    const timeout = setTimeout(() => {
      setNotifications((prev) => prev.filter((toast) => toast.id !== id));
      notificationTimeoutsRef.current.delete(id);
    }, OFFSCREEN_TOAST_DURATION_MS);
    notificationTimeoutsRef.current.set(id, timeout);
  }, []);

  useEffect(() => () => {
    entryTimeoutsRef.current.forEach((entry) => {
      clearTimeout(entry.activate);
      clearTimeout(entry.cleanup);
    });
    entryTimeoutsRef.current.clear();
  }, []);

  useEffect(() => () => {
    notificationTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    notificationTimeoutsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!objectsLoaded) {
      return;
    }
    if (!entryInitializedRef.current) {
      entryInitializedRef.current = true;
      prevEntryObjectsRef.current = objects ?? {};
      return;
    }
    const prevObjects = prevEntryObjectsRef.current;
    Object.keys(objects ?? {}).forEach((objectId) => {
      if (prevObjects[objectId]) {
        return;
      }
      if (localCreatedSet.has(objectId)) {
        return;
      }
      triggerRemoteEntry(objectId);
    });
    prevEntryObjectsRef.current = objects ?? {};
  }, [objects, objectsLoaded, localCreatedSet, triggerRemoteEntry]);

  useEffect(() => {
    if (!objectsLoaded || !user) {
      return;
    }
    if (!notificationInitializedRef.current) {
      notificationInitializedRef.current = true;
      prevNotificationObjectsRef.current = objects ?? {};
      return;
    }
    const prevObjects = prevNotificationObjectsRef.current;
    const now = Date.now();
    Object.entries(objects ?? {}).forEach(([objectId, object]) => {
      if (object.updatedBy && object.updatedBy === user.uid) {
        return;
      }
      const prevObject = prevObjects[objectId];
      const isNew = !prevObject;
      const moved = prevObject && (prevObject.x !== object.x || prevObject.y !== object.y);
      if (!isNew && !moved) {
        return;
      }
      const point = boardToScreen(object.x, object.y, panX, panY, zoom);
      const offscreen = point.x < 0 || point.y < 0 || point.x > viewportWidth || point.y > viewportHeight;
      if (!offscreen) {
        return;
      }
      const lastNotified = lastNotificationRef.current[objectId] ?? 0;
      if (now - lastNotified < 2000) {
        return;
      }
      lastNotificationRef.current[objectId] = now;
      const actor = object.updatedByName ?? 'Someone';
      const action = isNew ? 'added' : 'moved';
      const labelLookup = {
        sticky: 'sticky note',
        rectangle: 'rectangle',
        circle: 'circle',
        line: 'line',
        text: 'text',
        frame: 'frame',
        connector: 'connector',
        embed: 'embed',
      };
      const label = labelLookup[object.type] ?? 'object';
      pushNotification(`${actor} ${action} a ${label}`);
    });
    prevNotificationObjectsRef.current = objects ?? {};
  }, [objects, objectsLoaded, panX, panY, pushNotification, user, viewportHeight, viewportWidth, zoom]);

  useEffect(() => {
    const boardEl = resolvedRef.current;
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

  const capturePointer = (event) => {
    if (event.pointerId === undefined) {
      return;
    }
    if (resolvedRef.current?.setPointerCapture) {
      resolvedRef.current.setPointerCapture(event.pointerId);
      pointerCaptureRef.current = event.pointerId;
    }
  };

  const releasePointer = () => {
    if (pointerCaptureRef.current === null) {
      return;
    }
    if (resolvedRef.current?.releasePointerCapture) {
      resolvedRef.current.releasePointerCapture(pointerCaptureRef.current);
    }
    pointerCaptureRef.current = null;
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) {
      return;
    }

    const rotationHit = event.target.closest('[data-rotation-handle]');
    if (rotationHit && (selectedObject || selectionSet.size > 1)) {
      const rect = resolvedRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const target = selectedObject ?? {};
      onRotationStart?.(target, event.clientX - rect.left, event.clientY - rect.top);
      capturePointer(event);
      event.preventDefault();
      return;
    }

    const handleHit = event.target.closest('[data-resize-handle]');
    if (handleHit && (selectedObject || selectionSet.size > 1)) {
      const rect = resolvedRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const handlePosition = handleHit.getAttribute('data-resize-handle');
      if (handlePosition) {
        const target = selectedObject ?? {};
        onResizeStart?.(
          target,
          handlePosition,
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
        capturePointer(event);
        setActiveResizeCursor(RESIZE_CURSORS[handlePosition] ?? '');
      }
      event.preventDefault();
      return;
    }

    const objectHit = event.target.closest('[data-object-id]');
    if (objectHit) {
      return;
    }

    const rect = resolvedRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    if (event.shiftKey && onMarqueeStart) {
      onMarqueeStart(event.clientX - rect.left, event.clientY - rect.top);
      capturePointer(event);
      return;
    }
    if (connectorMode) {
      return;
    }
    onClearSelection?.();
    handlePanStart(event.clientX - rect.left, event.clientY - rect.top, event.pointerId);
  };

  const handlePointerMove = (event) => {
    const rect = resolvedRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const containerX = event.clientX - rect.left;
    const containerY = event.clientY - rect.top;
    if (pendingDragRef.current) {
      const dx = containerX - pendingDragRef.current.startX;
      const dy = containerY - pendingDragRef.current.startY;
      if (!isClickThreshold(dx, dy)) {
        const { object, nextSelection } = pendingDragRef.current;
        const selectedObjects = nextSelection.size > 1
          ? Array.from(nextSelection)
            .map((id) => objects?.[id])
            .filter(Boolean)
          : null;
        onDragStart?.(object, containerX, containerY, selectedObjects);
        pendingDragRef.current = null;
      }
    }
    handlePanMove(containerX, containerY);
    onDragMove?.(containerX, containerY);
    onResizeMove?.(containerX, containerY);
    onRotationMove?.(containerX, containerY);
    onMarqueeMove?.(containerX, containerY);
    onCursorMove?.(containerX, containerY);
  };

  const handlePointerEnd = (event) => {
    pendingDragRef.current = null;
    const rect = resolvedRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const containerX = event.clientX - rect.left;
    const containerY = event.clientY - rect.top;
    onDragEnd?.(containerX, containerY);
    onResizeEnd?.();
    onRotationEnd?.();
    onMarqueeEnd?.();
    setActiveResizeCursor('');
    handlePanEnd(event.pointerId);
    releasePointer();
  };

  const handleObjectSelect = (objectId, event) => {
    if (event?.shiftKey) {
      const next = new Set(selectionSet);
      if (next.has(objectId)) {
        next.delete(objectId);
      } else {
        next.add(objectId);
      }
      onSetSelection?.(next);
      return;
    }
    if (connectorMode) {
      onConnectorCandidate?.(objectId);
      return;
    }
    onSetSelection?.(new Set([objectId]));
  };

  const handleObjectPointerDown = (object, event) => {
    const rect = resolvedRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    if (connectorMode && !event.shiftKey) {
      onConnectorCandidate?.(object.id);
      return;
    }
    const nextSelection = computeNextSelection(selectionSet, object.id, event.shiftKey);
    onSetSelection?.(nextSelection);
    const containerX = event.clientX - rect.left;
    const containerY = event.clientY - rect.top;
    pendingDragRef.current = {
      object,
      nextSelection,
      startX: containerX,
      startY: containerY,
    };
    capturePointer(event);
  };

  const handleObjectUpdate = (objectId, updates) => {
    if (!objects?.[objectId]) {
      return;
    }
    onUpdateObject?.(objectId, updates);
  };

  const handleEditingStateChange = (objectId, isEditing) => {
    onEditingChange?.(objectId, isEditing);
  };

  return (
    <div
      ref={resolvedRef}
      data-testid="board-outer"
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        background: '#f0f0f0',
        touchAction: 'none',
        userSelect: 'none',
        cursor: activeResizeCursor || (draggingId ? 'grabbing' : isPanning ? 'grabbing' : connectorMode ? 'crosshair' : 'default'),
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {!objectsLoaded && (
        <div
          data-testid="board-loading"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            fontWeight: 600,
          }}
        >
          Loading board…
        </div>
      )}
      <div
        data-testid="board-inner"
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
          transformOrigin: '0 0',
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          opacity: objectsLoaded ? 1 : 0.4,
        }}
      >
        {sortedObjects.map((object) => {
          const remoteEntryPhase = remoteEntryPhases[object.id];
          const lockEntry = lockedObjectIds?.[object.id];
          const lockedByOther = Boolean(lockEntry);
          return (
            <div key={object.id}>
              {object.type === 'sticky' && (
                <StickyNote
                  object={object}
                  isDragging={object.id === draggingId}
                  lockedByOther={lockedByOther}
                  onUpdate={handleObjectUpdate}
                  onObjectPointerDown={handleObjectPointerDown}
                  onEditStateChange={handleEditingStateChange}
                  zoom={zoom}
                  remoteEntryPhase={remoteEntryPhase}
                  interactionMode={connectorMode ? 'connecting' : 'idle'}
                />
              )}
              {object.type === 'rectangle' && (
                <Rectangle
                  object={object}
                  isDragging={object.id === draggingId}
                  lockedByOther={lockedByOther}
                  onUpdate={handleObjectUpdate}
                  onObjectPointerDown={handleObjectPointerDown}
                  onResizeStart={onResizeStart}
                  zoom={zoom}
                  remoteEntryPhase={remoteEntryPhase}
                  interactionMode={connectorMode ? 'connecting' : 'idle'}
                />
              )}
              {object.type === 'circle' && (
                <Circle
                  object={object}
                  isDragging={object.id === draggingId}
                  lockedByOther={lockedByOther}
                  onUpdate={handleObjectUpdate}
                  onObjectPointerDown={handleObjectPointerDown}
                  onResizeStart={onResizeStart}
                  zoom={zoom}
                  remoteEntryPhase={remoteEntryPhase}
                  interactionMode={connectorMode ? 'connecting' : 'idle'}
                />
              )}
              {object.type === 'line' && (
                <Line
                  object={object}
                  isSelected={selectionSet.has(object.id)}
                  isDragging={object.id === draggingId}
                  lockedByOther={lockedByOther}
                  onObjectPointerDown={handleObjectPointerDown}
                  onEndpointSelect={handleObjectSelect}
                  onUpdate={handleObjectUpdate}
                  zoom={zoom}
                  remoteEntryPhase={remoteEntryPhase}
                  interactionMode={connectorMode ? 'connecting' : 'idle'}
                />
              )}
              {object.type === 'text' && (
                <TextElement
                  object={object}
                  isDragging={object.id === draggingId}
                  lockedByOther={lockedByOther}
                  onUpdate={handleObjectUpdate}
                  onObjectPointerDown={handleObjectPointerDown}
                  onResizeStart={onResizeStart}
                  onEditStateChange={handleEditingStateChange}
                  zoom={zoom}
                  remoteEntryPhase={remoteEntryPhase}
                  interactionMode={connectorMode ? 'connecting' : 'idle'}
                />
              )}
              {object.type === 'frame' && (
                <Frame
                  object={object}
                  isDragging={object.id === draggingId}
                  lockedByOther={lockedByOther}
                  onUpdate={handleObjectUpdate}
                  onObjectPointerDown={handleObjectPointerDown}
                  onResizeStart={onResizeStart}
                  onEditStateChange={handleEditingStateChange}
                  zoom={zoom}
                  remoteEntryPhase={remoteEntryPhase}
                  interactionMode={connectorMode ? 'connecting' : 'idle'}
                />
              )}
              {object.type === 'connector' && (
                <Connector
                  connector={object}
                  objects={objects}
                  onSelect={handleObjectSelect}
                />
              )}
              {object.type === 'embed' && (
                <EmbedObject
                  object={object}
                  isSelected={selectionSet.has(object.id)}
                  isDragging={object.id === draggingId}
                  lockedByOther={lockedByOther}
                  onObjectPointerDown={handleObjectPointerDown}
                  zoom={zoom}
                  remoteEntryPhase={remoteEntryPhase}
                  interactionMode={connectorMode ? 'connecting' : 'idle'}
                />
              )}
              {lockedByOther && (
                <div
                  data-testid="remote-selection-label"
                  style={{
                    position: 'absolute',
                    left: object.x,
                    top: object.y - 22,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    background: '#3b82f6',
                    color: '#fff',
                    borderRadius: 4,
                    whiteSpace: 'nowrap',
                    zIndex: (object.zIndex ?? 0) + 2,
                    pointerEvents: 'none',
                  }}
                >
                  {lockEntry.name}
                </div>
              )}
            </div>
          );
        })}
        {objectsLoaded && sortedObjects.length === 0 && (
          <div
            data-testid="empty-board-hint"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#9ca3af',
              fontSize: 15,
              textAlign: 'center',
              pointerEvents: 'none',
              userSelect: 'none',
              lineHeight: 1.6,
            }}
          >
            Press <strong>S</strong> to add a sticky note<br />
            or <strong>R</strong> for a rectangle
          </div>
        )}
        {selectionSet.size > 1 && selectionBounds && (
          <SelectionOverlay
            object={selectionBounds}
            isResizable
            zoom={zoom}
            showRotation
          />
        )}
        {selectionSet.size <= 1 && selectedObject && selectedObject.type !== 'line' && selectedObject.type !== 'connector' && (
          <SelectionOverlay
            object={selectionBounds ?? selectedObject}
            isResizable={selectedObject.type === 'rectangle' || selectedObject.type === 'sticky' || selectedObject.type === 'circle' || selectedObject.type === 'text' || selectedObject.type === 'frame' || selectedObject.type === 'embed'}
            zoom={zoom}
            showRotation={selectedObject.type !== 'line' && selectedObject.type !== 'connector'}
          />
        )}
        {marqueeBounds && (
          <SelectionMarquee bounds={marqueeBounds} zoom={zoom} />
        )}
      </div>
      {notifications.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: 'none',
            zIndex: 210,
          }}
        >
          {notifications.map((toast) => (
            <div
              key={toast.id}
              data-testid="remote-change-toast"
              style={{
                background: 'rgba(17, 24, 39, 0.9)',
                color: '#f9fafb',
                padding: '6px 10px',
                borderRadius: 10,
                fontSize: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
