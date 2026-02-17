import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onValue, ref, remove, set, update } from 'firebase/database';
import { db, BOARD_ID } from '../firebase/config.js';
import {
  DEFAULT_RECTANGLE_COLOR,
  DEFAULT_STICKY_COLOR,
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
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: user?.uid ?? null,
  updatedBy: user?.uid ?? null,
  updatedByName: user?.displayName ?? null,
});

export const useBoardObjects = ({ user, draggingId = null, editingId = null } = {}) => {
  const [objects, setObjects] = useState({});
  const [objectsLoaded, setObjectsLoaded] = useState(false);
  const localCreatedIds = useRef(new Set());

  useEffect(() => {
    const objectsRef = ref(db, `boards/${BOARD_ID}/objects`);
    const unsubscribe = onValue(objectsRef, (snapshot) => {
      const next = snapshot.val() ?? {};
      setObjects(next);
      setObjectsLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  const updateObject = useCallback((objectId, updates) => {
    const objectRef = ref(db, `boards/${BOARD_ID}/objects/${objectId}`);
    return update(objectRef, {
      ...updates,
      updatedAt: Date.now(),
      updatedBy: user?.uid ?? null,
      updatedByName: user?.displayName ?? null,
    });
  }, [user]);

  const createStickyNote = useCallback((panX, panY, zoom, viewportWidth, viewportHeight, zIndex) => {
    const position = viewportCenter(panX, panY, zoom, viewportWidth, viewportHeight);
    const sticky = {
      ...createSticky(position, user),
      zIndex,
    };
    localCreatedIds.current.add(sticky.id);
    const objectRef = ref(db, `boards/${BOARD_ID}/objects/${sticky.id}`);
    return set(objectRef, sticky);
  }, [user]);

  const createRectangle = useCallback((panX, panY, zoom, viewportWidth, viewportHeight, zIndex) => {
    const position = viewportCenter(panX, panY, zoom, viewportWidth, viewportHeight);
    const rectangle = {
      ...createRectangleObject(position, user),
      zIndex,
    };
    localCreatedIds.current.add(rectangle.id);
    const objectRef = ref(db, `boards/${BOARD_ID}/objects/${rectangle.id}`);
    return set(objectRef, rectangle);
  }, [user]);

  const deleteObject = useCallback((objectId) => {
    const objectRef = ref(db, `boards/${BOARD_ID}/objects/${objectId}`);
    return remove(objectRef);
  }, []);

  const value = useMemo(() => ({
    objects,
    objectsLoaded,
    updateObject,
    createStickyNote,
    createRectangle,
    deleteObject,
    localCreatedIds: localCreatedIds.current,
  }), [objects, objectsLoaded, updateObject, createStickyNote, createRectangle, deleteObject]);

  return value;
};
