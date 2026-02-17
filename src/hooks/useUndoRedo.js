import { useCallback, useRef, useState } from 'react';

const DEFAULT_MAX = 50;

export const useUndoRedo = ({ deleteObject, restoreObject, updateObject, maxSize = DEFAULT_MAX }) => {
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const executingRef = useRef(false);

  const push = useCallback((action) => {
    if (executingRef.current) {
      return;
    }
    setUndoStack((prev) => {
      const next = [...prev, action];
      if (next.length > maxSize) {
        next.shift();
      }
      return next;
    });
    setRedoStack([]);
  }, [maxSize]);

  const applyUndo = useCallback(async (action) => {
    if (!action) {
      return;
    }
    if (action.type === 'create') {
      await deleteObject(action.object.id);
      return;
    }
    if (action.type === 'delete') {
      await restoreObject(action.object.id, action.object);
      return;
    }
    if (action.type === 'update') {
      await updateObject(action.objectId, action.before);
    }
  }, [deleteObject, restoreObject, updateObject]);

  const applyRedo = useCallback(async (action) => {
    if (!action) {
      return;
    }
    if (action.type === 'create') {
      await restoreObject(action.object.id, action.object);
      return;
    }
    if (action.type === 'delete') {
      await deleteObject(action.object.id);
      return;
    }
    if (action.type === 'update') {
      await updateObject(action.objectId, action.after);
    }
  }, [deleteObject, restoreObject, updateObject]);

  const undo = useCallback(async () => {
    if (!undoStack.length) {
      return;
    }
    const action = undoStack[undoStack.length - 1];
    executingRef.current = true;
    try {
      await applyUndo(action);
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, action]);
    } finally {
      executingRef.current = false;
    }
  }, [applyUndo, undoStack]);

  const redo = useCallback(async () => {
    if (!redoStack.length) {
      return;
    }
    const action = redoStack[redoStack.length - 1];
    executingRef.current = true;
    try {
      await applyRedo(action);
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, action]);
    } finally {
      executingRef.current = false;
    }
  }, [applyRedo, redoStack]);

  return {
    undoStack,
    redoStack,
    push,
    undo,
    redo,
    isExecuting: executingRef.current,
  };
};
