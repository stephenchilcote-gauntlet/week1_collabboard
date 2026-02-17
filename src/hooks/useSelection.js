import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { onDisconnect, onValue, ref, remove, set } from 'firebase/database';
import { db, BOARD_ID } from '../firebase/config.js';

export const useSelection = (objects = {}, user = null) => {
  const [selectedId, setSelectedId] = useState(null);
  const [remoteSelections, setRemoteSelections] = useState({});
  const cleanupRef = useRef(null);

  // Compute which objectIds are locked by OTHER users: objectId → { uid, name }
  const lockedObjectIds = useMemo(() => {
    const locked = {};
    if (!user) return locked;
    for (const [uid, entry] of Object.entries(remoteSelections)) {
      if (uid !== user.uid && entry.objectId) {
        locked[entry.objectId] = { uid, name: entry.name ?? 'Anonymous' };
      }
    }
    return locked;
  }, [remoteSelections, user]);

  // Keep a ref so select() always sees the latest locked set
  const lockedRef = useRef(lockedObjectIds);
  lockedRef.current = lockedObjectIds;

  // Subscribe to all selections
  useEffect(() => {
    const selectionsRef = ref(db, `boards/${BOARD_ID}/selections`);
    const unsubscribe = onValue(selectionsRef, (snapshot) => {
      setRemoteSelections(snapshot.val() ?? {});
    });
    return () => unsubscribe();
  }, []);

  // Sync local selection to Firebase
  useEffect(() => {
    if (!user) return undefined;
    const selectionRef = ref(db, `boards/${BOARD_ID}/selections/${user.uid}`);

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (selectedId) {
      set(selectionRef, { objectId: selectedId, name: user.displayName ?? 'Anonymous' });
    } else {
      remove(selectionRef);
    }

    const disconnectRef = onDisconnect(selectionRef);
    disconnectRef.remove();
    cleanupRef.current = () => disconnectRef.cancel();

    return undefined;
  }, [selectedId, user]);

  // Clean up on unmount
  useEffect(() => {
    if (!user) return undefined;
    const selectionRef = ref(db, `boards/${BOARD_ID}/selections/${user.uid}`);
    return () => {
      remove(selectionRef);
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [user]);

  useEffect(() => {
    if (selectedId && !objects[selectedId]) {
      setSelectedId(null);
    }
  }, [objects, selectedId]);

  // Also deselect if another user locks the object we currently have selected
  useEffect(() => {
    if (selectedId && lockedObjectIds[selectedId]) {
      setSelectedId(null);
    }
  }, [selectedId, lockedObjectIds]);

  const select = useCallback((objectId) => {
    if (objectId && lockedRef.current[objectId]) {
      return;
    }
    setSelectedId(objectId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
  }, []);

  return {
    selectedId,
    select,
    clearSelection,
    lockedObjectIds,
  };
};
