import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { onDisconnect, onValue, ref, remove, set } from 'firebase/database';
import { db, BOARD_ID } from '../firebase/config.js';
import { intersectsRect } from '../utils/coordinates.js';

export const useSelection = (objects = {}, user = null, presenceList = []) => {
  const [selectedIds, setSelectedIds] = useState(new Set());
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
      const next = snapshot.val() ?? {};
      const sanitized = Object.entries(next).reduce((acc, [uid, entry]) => {
        if (entry && typeof entry.objectId === 'string') {
          acc[uid] = entry;
        }
        return acc;
      }, {});
      setRemoteSelections(sanitized);
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
    const primaryId = selectedIds.values().next().value;

    if (primaryId) {
      set(selectionRef, { objectId: primaryId, name: user.displayName ?? 'Anonymous' });
    } else {
      remove(selectionRef);
    }

    return undefined;
  }, [selectedIds, user]);

  useEffect(() => {
    if (selectedIds.size === 0) {
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of next) {
        if (!objects[id]) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [objects, selectedIds]);

  // Also deselect if another user locks objects we currently have selected
  useEffect(() => {
    if (selectedIds.size === 0) {
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of next) {
        if (lockedObjectIds[id]) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [lockedObjectIds, selectedIds]);

  const select = useCallback((objectId) => {
    if (objectId && lockedRef.current[objectId]) {
      return;
    }
    setSelectedIds(new Set([objectId]));
  }, []);

  const toggleSelection = useCallback((objectId) => {
    if (!objectId || lockedRef.current[objectId]) {
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(objectId)) {
        next.delete(objectId);
      } else {
        next.add(objectId);
      }
      return next;
    });
  }, []);

  const setSelection = useCallback((ids) => {
    const next = new Set(ids);
    for (const id of next) {
      if (lockedRef.current[id]) {
        next.delete(id);
      }
    }
    setSelectedIds(next);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const primarySelectedId = selectedIds.values().next().value ?? null;

  const getSelectionBounds = useCallback(() => {
    if (!selectedIds.size) {
      return null;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    selectedIds.forEach((id) => {
      const obj = objects[id];
      if (!obj) {
        return;
      }
      const width = obj.width ?? Math.abs((obj.x2 ?? obj.x ?? 0) - (obj.x1 ?? obj.x ?? 0));
      const height = obj.height ?? Math.abs((obj.y2 ?? obj.y ?? 0) - (obj.y1 ?? obj.y ?? 0));
      const x = obj.x ?? Math.min(obj.x1 ?? 0, obj.x2 ?? 0);
      const y = obj.y ?? Math.min(obj.y1 ?? 0, obj.y2 ?? 0);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });
    if (!Number.isFinite(minX)) {
      return null;
    }
    const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    if (selectedIds.size === 1) {
      const obj = objects[selectedIds.values().next().value];
      if (obj?.rotation) {
        bounds.rotation = obj.rotation;
      }
      if (obj?.zIndex != null) {
        bounds.zIndex = obj.zIndex;
      }
    }
    return bounds;
  }, [objects, selectedIds]);

  const getIntersectingIds = useCallback((objectsList, marqueeBounds) => {
    if (!marqueeBounds) {
      return [];
    }
    return Object.values(objectsList ?? {}).reduce((acc, obj) => {
      const width = obj.width ?? Math.abs((obj.x2 ?? obj.x ?? 0) - (obj.x1 ?? obj.x ?? 0));
      const height = obj.height ?? Math.abs((obj.y2 ?? obj.y ?? 0) - (obj.y1 ?? obj.y ?? 0));
      const x = obj.x ?? Math.min(obj.x1 ?? 0, obj.x2 ?? 0);
      const y = obj.y ?? Math.min(obj.y1 ?? 0, obj.y2 ?? 0);
      const rect = { x, y, width, height };
      if (intersectsRect(rect, marqueeBounds)) {
        acc.push(obj.id);
      }
      return acc;
    }, []);
  }, [intersectsRect]);

  return {
    selectedId: primarySelectedId,
    selectedIds,
    select,
    toggleSelection,
    setSelection,
    clearSelection,
    getSelectionBounds,
    getIntersectingIds,
    lockedObjectIds,
  };
};
