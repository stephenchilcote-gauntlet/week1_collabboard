import { useCallback, useEffect, useMemo, useState } from 'react';
import { onValue, ref, set, update } from 'firebase/database';
import { db, BOARD_ID } from '../firebase/config.js';
import {
  DEFAULT_RECTANGLE_COLOR,
  DEFAULT_STICKY_COLOR,
} from '../utils/colors.js';
import { generateId } from '../utils/ids.js';
import { viewportCenter } from '../utils/coordinates.js';

const createSticky = ({ x, y }) => ({
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
});

const createRectangleObject = ({ x, y }) => ({
  id: generateId(),
  type: 'rectangle',
  x,
  y,
  width: 240,
  height: 160,
  color: DEFAULT_RECTANGLE_COLOR,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const useBoardObjects = () => {
  const [objects, setObjects] = useState({});
  const [objectsLoaded, setObjectsLoaded] = useState(false);

  useEffect(() => {
    const objectsRef = ref(db, `boards/${BOARD_ID}/objects`);
    const unsubscribe = onValue(objectsRef, (snapshot) => {
      setObjects(snapshot.val() ?? {});
      setObjectsLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  const updateObject = useCallback((objectId, updates) => {
    const objectRef = ref(db, `boards/${BOARD_ID}/objects/${objectId}`);
    return update(objectRef, {
      ...updates,
      updatedAt: Date.now(),
    });
  }, []);

  const createStickyNote = useCallback((panX, panY, zoom, viewportWidth, viewportHeight) => {
    const position = viewportCenter(panX, panY, zoom, viewportWidth, viewportHeight);
    const sticky = createSticky(position);
    const objectRef = ref(db, `boards/${BOARD_ID}/objects/${sticky.id}`);
    return set(objectRef, sticky);
  }, []);

  const createRectangle = useCallback((panX, panY, zoom, viewportWidth, viewportHeight) => {
    const position = viewportCenter(panX, panY, zoom, viewportWidth, viewportHeight);
    const rectangle = createRectangleObject(position);
    const objectRef = ref(db, `boards/${BOARD_ID}/objects/${rectangle.id}`);
    return set(objectRef, rectangle);
  }, []);

  const value = useMemo(() => ({
    objects,
    objectsLoaded,
    updateObject,
    createStickyNote,
    createRectangle,
  }), [objects, objectsLoaded, updateObject, createStickyNote, createRectangle]);

  return value;
};
