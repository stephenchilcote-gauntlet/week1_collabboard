import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onDisconnect, onValue, ref, set, update } from 'firebase/database';
import { auth, db, BOARD_ID } from '../firebase/config.js';
import { screenToBoard } from '../utils/coordinates.js';
import { throttle } from '../utils/throttle.js';

const CURSOR_WRITE_INTERVAL = 50;

export const useCursors = (user) => {
  const [cursors, setCursors] = useState({});
  const throttledRef = useRef(null);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const cursorsRef = ref(db, `boards/${BOARD_ID}/cursors`);
    const userCursorRef = ref(db, `boards/${BOARD_ID}/cursors/${user.uid}`);

    const unsubscribe = onValue(cursorsRef, (snapshot) => {
      const next = snapshot.val() ?? {};
      const sanitized = Object.entries(next).reduce((acc, [uid, entry]) => {
        if (entry && typeof entry.uid === 'string') {
          acc[uid] = entry;
        }
        return acc;
      }, {});
      setCursors(sanitized);
    });

    set(userCursorRef, {
      uid: user.uid,
      name: user.displayName ?? 'Anonymous',
      x: 0,
      y: 0,
      updatedAt: Date.now(),
    });

    onDisconnect(userCursorRef).remove();

    throttledRef.current = throttle((payload) => {
      update(userCursorRef, payload);
    }, CURSOR_WRITE_INTERVAL);

    return () => {
      throttledRef.current?.flush();
      throttledRef.current = null;
      if (user?.uid && auth.currentUser) {
        update(userCursorRef, {
          x: null,
          y: null,
          updatedAt: Date.now(),
        });
      }
      unsubscribe();
    };
  }, [user]);

  const updateCursor = useCallback((screenX, screenY, panX, panY, zoom) => {
    if (!user || !throttledRef.current) {
      return;
    }
    const boardPoint = screenToBoard(screenX, screenY, panX, panY, zoom);
    throttledRef.current({
      x: boardPoint.x,
      y: boardPoint.y,
      updatedAt: Date.now(),
    });
  }, [user]);

  const value = useMemo(() => ({ cursors, updateCursor }), [cursors, updateCursor]);

  return value;
};
