import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { onDisconnect, onValue, ref, remove, set } from 'firebase/database';
import { db, BOARD_ID } from '../firebase/config.js';

export const useSelection = (objects = {}, user = null, presenceList = []) => {
  const [selectedId, setSelectedId] = useState(null);
  const [remoteSelections, setRemoteSelections] = useState({});

  const presentUids = useMemo(() => new Set(presenceList.map((p) => p.uid)), [presenceList]);

  // Compute which objectIds are locked by OTHER users: objectId → { uid, name }
  // Only consider users who are still present (heartbeat-verified)
  const lockedObjectIds = useMemo(() => {
    const locked = {};
    if (!user) return locked;
    for (const [uid, entry] of Object.entries(remoteSelections)) {
      if (uid !== user.uid && entry.objectId && presentUids.has(uid)) {
        locked[entry.objectId] = { uid, name: entry.name ?? 'Anonymous' };
      }
    }
    return locked;
  }, [remoteSelections, user, presentUids]);

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

  // Register onDisconnect via .info/connected so it survives reconnections
  useEffect(() => {
    if (!user) return undefined;
    const selectionRef = ref(db, `boards/${BOARD_ID}/selections/${user.uid}`);
    const connectedRef = ref(db, '.info/connected');

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (!snap.val()) return;
      onDisconnect(selectionRef).remove();
    });

    return () => {
      unsubscribe();
      remove(selectionRef);
    };
  }, [user]);

  // Sync local selection to Firebase
  useEffect(() => {
    if (!user) return undefined;
    const selectionRef = ref(db, `boards/${BOARD_ID}/selections/${user.uid}`);

    if (selectedId) {
      set(selectionRef, { objectId: selectedId, name: user.displayName ?? 'Anonymous' });
    } else {
      remove(selectionRef);
    }

    return undefined;
  }, [selectedId, user]);

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
