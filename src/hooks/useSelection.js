import { useState, useCallback, useEffect } from 'react';

export const useSelection = (objects = {}) => {
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (selectedId && !objects[selectedId]) {
      setSelectedId(null);
    }
  }, [objects, selectedId]);

  const select = useCallback((objectId) => {
    setSelectedId(objectId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
  }, []);

  return {
    selectedId,
    select,
    clearSelection,
  };
};
