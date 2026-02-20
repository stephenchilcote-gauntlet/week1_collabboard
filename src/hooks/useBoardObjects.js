import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onValue, ref, remove, set, update, child } from 'firebase/database';
import { db } from '../firebase/config.js';
import {
  DEFAULT_RECTANGLE_COLOR,
  DEFAULT_STICKY_COLOR,
  DEFAULT_CIRCLE_COLOR,
  DEFAULT_LINE_COLOR,
  DEFAULT_TEXT_COLOR,
} from '../utils/colors.js';
import { generateId } from '../utils/ids.js';
import { viewportCenter } from '../utils/coordinates.js';

const createSticky = ({ x, y }, user) => ({
  id: generateId(),
  type: 'sticky',
  x,
  y,
  width: 200,
  height: 160,
  color: DEFAULT_STICKY_COLOR,
  text: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: user?.uid ?? null,
  updatedBy: user?.uid ?? null,
  updatedByName: user?.displayName ?? null,
});

const createRectangleObject = ({ x, y }, user) => ({
  id: generateId(),
  type: 'rectangle',
  x,
  y,
  width: 240,
  height: 160,
  color: DEFAULT_RECTANGLE_COLOR,
  text: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: user?.uid ?? null,
  updatedBy: user?.uid ?? null,
  updatedByName: user?.displayName ?? null,
});

const createCircleObject = ({ x, y }, user) => ({
  id: generateId(),
  type: 'circle',
  x,
  y,
  width: 200,
  height: 200,
  color: DEFAULT_CIRCLE_COLOR,
  text: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: user?.uid ?? null,
  updatedBy: user?.uid ?? null,
  updatedByName: user?.displayName ?? null,
});

const createLineObject = ({ x, y }, user) => ({
  id: generateId(),
  type: 'line',
  x1: x - 100,
  y1: y - 40,
  x2: x + 100,
  y2: y + 40,
  strokeWidth: 2,
  color: DEFAULT_LINE_COLOR,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: user?.uid ?? null,
  updatedBy: user?.uid ?? null,
  updatedByName: user?.displayName ?? null,
});

const createTextObject = ({ x, y }, user) => ({
  id: generateId(),
  type: 'text',
  x,
  y,
  width: 200,
  height: 60,
  text: 'New text',
  fontSize: 16,
  color: DEFAULT_TEXT_COLOR,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: user?.uid ?? null,
  updatedBy: user?.uid ?? null,
  updatedByName: user?.displayName ?? null,
});

const createFrameObject = ({ x, y }, user) => ({
  id: generateId(),
  type: 'frame',
  x,
  y,
  width: 420,
  height: 260,
  title: 'Frame',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: user?.uid ?? null,
  updatedBy: user?.uid ?? null,
  updatedByName: user?.displayName ?? null,
});

const createConnectorObject = ({ fromId, toId, style = 'line' }, user) => ({
  id: generateId(),
  type: 'connector',
  fromId,
  toId,
  style,
  strokeWidth: 2,
  color: '#111827',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: user?.uid ?? null,
  updatedBy: user?.uid ?? null,
  updatedByName: user?.displayName ?? null,
});

export const useBoardObjects = ({ user, boardName, draggingId = null, editingId = null } = {}) => {
  const [objects, setObjects] = useState({});
  const [objectsLoaded, setObjectsLoaded] = useState(false);
  const localCreatedIds = useRef(new Set());

  useEffect(() => {
    const objectsRef = ref(db, `boards/${boardName}/objects`);
    const unsubscribe = onValue(objectsRef, (snapshot) => {
      const next = snapshot.val() ?? {};
      setObjects(next);
      setObjectsLoaded(true);
    });

    return () => unsubscribe();
  }, [boardName]);

  const updateObject = useCallback((objectId, updates) => {
    const objectRef = ref(db, `boards/${boardName}/objects/${objectId}`);
    return update(objectRef, {
      ...updates,
      updatedAt: Date.now(),
      updatedBy: user?.uid ?? null,
      updatedByName: user?.displayName ?? null,
    });
  }, [boardName, user]);

  const createStickyNote = useCallback((panX, panY, zoom, viewportWidth, viewportHeight, zIndex) => {
    const position = viewportCenter(panX, panY, zoom, viewportWidth, viewportHeight);
    const sticky = {
      ...createSticky(position, user),
      zIndex,
    };
    localCreatedIds.current.add(sticky.id);
    const objectRef = ref(db, `boards/${boardName}/objects/${sticky.id}`);
    return set(objectRef, sticky).then(() => sticky);
  }, [boardName, user]);

  const createRectangle = useCallback((panX, panY, zoom, viewportWidth, viewportHeight, zIndex) => {
    const position = viewportCenter(panX, panY, zoom, viewportWidth, viewportHeight);
    const rectangle = {
      ...createRectangleObject(position, user),
      zIndex,
    };
    localCreatedIds.current.add(rectangle.id);
    const objectRef = ref(db, `boards/${boardName}/objects/${rectangle.id}`);
    return set(objectRef, rectangle).then(() => rectangle);
  }, [boardName, user]);

  const createCircle = useCallback((panX, panY, zoom, viewportWidth, viewportHeight, zIndex) => {
    const position = viewportCenter(panX, panY, zoom, viewportWidth, viewportHeight);
    const circle = {
      ...createCircleObject(position, user),
      zIndex,
    };
    localCreatedIds.current.add(circle.id);
    const objectRef = ref(db, `boards/${boardName}/objects/${circle.id}`);
    return set(objectRef, circle).then(() => circle);
  }, [boardName, user]);

  const createLine = useCallback((panX, panY, zoom, viewportWidth, viewportHeight, zIndex) => {
    const position = viewportCenter(panX, panY, zoom, viewportWidth, viewportHeight);
    const line = {
      ...createLineObject(position, user),
      zIndex,
    };
    localCreatedIds.current.add(line.id);
    const objectRef = ref(db, `boards/${boardName}/objects/${line.id}`);
    return set(objectRef, line).then(() => line);
  }, [boardName, user]);

  const createText = useCallback((panX, panY, zoom, viewportWidth, viewportHeight, zIndex) => {
    const position = viewportCenter(panX, panY, zoom, viewportWidth, viewportHeight);
    const text = {
      ...createTextObject(position, user),
      zIndex,
    };
    localCreatedIds.current.add(text.id);
    const objectRef = ref(db, `boards/${boardName}/objects/${text.id}`);
    return set(objectRef, text).then(() => text);
  }, [boardName, user]);

  const createFrame = useCallback((panX, panY, zoom, viewportWidth, viewportHeight, zIndex) => {
    const position = viewportCenter(panX, panY, zoom, viewportWidth, viewportHeight);
    const frame = {
      ...createFrameObject(position, user),
      zIndex,
    };
    localCreatedIds.current.add(frame.id);
    const objectRef = ref(db, `boards/${boardName}/objects/${frame.id}`);
    return set(objectRef, frame).then(() => frame);
  }, [boardName, user]);

  const createConnector = useCallback((fromId, toId, style = 'line', zIndex = 0) => {
    const connector = {
      ...createConnectorObject({ fromId, toId, style }, user),
      zIndex,
    };
    localCreatedIds.current.add(connector.id);
    const objectRef = ref(db, `boards/${boardName}/objects/${connector.id}`);
    return set(objectRef, connector).then(() => connector);
  }, [boardName, user]);

  const createObject = useCallback((objectData) => {
    const id = objectData.id ?? generateId();
    const object = {
      ...objectData,
      id,
      createdAt: objectData.createdAt ?? Date.now(),
      updatedAt: objectData.updatedAt ?? Date.now(),
      createdBy: user?.uid ?? null,
      updatedBy: user?.uid ?? null,
      updatedByName: user?.displayName ?? null,
    };
    localCreatedIds.current.add(id);
    const objectRef = ref(db, `boards/${boardName}/objects/${id}`);
    return set(objectRef, object).then(() => object);
  }, [boardName, user]);

  const deleteObject = useCallback((objectId) => {
    const objectRef = ref(db, `boards/${boardName}/objects/${objectId}`);
    return remove(objectRef);
  }, [boardName]);

  const restoreObject = useCallback((objectId, objectData) => {
    const objectRef = ref(db, `boards/${boardName}/objects/${objectId}`);
    return set(objectRef, objectData);
  }, [boardName]);

  const clearBoard = useCallback(() => {
    const objectsRef = ref(db, `boards/${boardName}/objects`);
    return remove(objectsRef);
  }, [boardName]);

  const value = useMemo(() => ({
    objects,
    objectsLoaded,
    updateObject,
    createStickyNote,
    createRectangle,
    createCircle,
    createLine,
    createText,
    createFrame,
    createConnector,
    createObject,
    deleteObject,
    restoreObject,
    clearBoard,
    localCreatedIds: localCreatedIds.current,
  }), [
    objects,
    objectsLoaded,
    updateObject,
    createStickyNote,
    createRectangle,
    createCircle,
    createLine,
    createText,
    createFrame,
    createConnector,
    createObject,
    deleteObject,
    restoreObject,
    clearBoard,
  ]);

  return value;
};
