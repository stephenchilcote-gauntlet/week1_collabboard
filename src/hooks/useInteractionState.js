import { useState, useCallback } from 'react';

const initialState = {
  mode: 'idle',
  activeObjectId: null,
};

export const useInteractionState = () => {
  const [state, setState] = useState(initialState);

  const setMode = useCallback((mode, objectId = null) => {
    if (mode === 'idle') {
      setState(initialState);
      return;
    }

    setState({
      mode,
      activeObjectId: objectId,
    });
  }, []);

  return {
    mode: state.mode,
    activeObjectId: state.activeObjectId,
    setMode,
  };
};
