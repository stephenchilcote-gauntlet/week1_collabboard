import { useCallback, useRef } from 'react';
import { generateId } from '../utils/ids.js';

const OFFSET = 20;

export const cloneWithOffset = (object, offsetX, offsetY) => ({
  ...object,
  id: generateId(),
  x: (object.x ?? 0) + offsetX,
  y: (object.y ?? 0) + offsetY,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const useClipboard = () => {
  const clipboardRef = useRef([]);

  const copy = useCallback((objects) => {
    clipboardRef.current = objects.map((object) => ({ ...object }));
  }, []);

  const paste = useCallback(() => {
    if (!clipboardRef.current.length) {
      return [];
    }
    return clipboardRef.current.map((object) => cloneWithOffset(object, OFFSET, OFFSET));
  }, []);

  const duplicate = useCallback((objects) => {
    copy(objects);
    return paste();
  }, [copy, paste]);

  return {
    copy,
    paste,
    duplicate,
  };
};
