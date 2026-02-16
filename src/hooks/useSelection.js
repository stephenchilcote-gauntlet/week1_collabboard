import { useState, useCallback } from 'react';

export const useSelection = () => {
  const [selectedId, setSelectedId] = useState(null);

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
