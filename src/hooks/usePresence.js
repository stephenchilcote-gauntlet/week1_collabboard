import { useEffect, useMemo, useRef, useState } from 'react';
import { onDisconnect, onValue, ref, remove, set, update } from 'firebase/database';
import { db, BOARD_ID } from '../firebase/config.js';

const HEARTBEAT_INTERVAL_MS = 5000;
const PRESENCE_TTL_MS = 15000;

export const usePresence = (user) => {
  const [presenceList, setPresenceList] = useState([]);
  const heartbeatRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setPresenceList([]);
      return undefined;
    }

    const presenceRef = ref(db, `boards/${BOARD_ID}/presence/${user.uid}`);
    const listRef = ref(db, `boards/${BOARD_ID}/presence`);
    const connectedRef = ref(db, '.info/connected');

    const unregisterHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    const unsubscribeConnected = onValue(connectedRef, (snap) => {
      if (!snap.val()) {
        return;
      }

      set(presenceRef, {
        uid: user.uid,
        name: user.displayName ?? 'Anonymous',
        photoURL: user.photoURL ?? null,
        lastActiveAt: Date.now(),
      });
      onDisconnect(presenceRef).remove();

      unregisterHeartbeat();
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      heartbeatRef.current = setInterval(() => {
        update(presenceRef, { lastActiveAt: Date.now() });
      }, HEARTBEAT_INTERVAL_MS);
    });

    const unsubscribeList = onValue(listRef, (snapshot) => {
      const value = snapshot.val() ?? {};
      const now = Date.now();
      const list = Object.values(value).filter((entry) => now - entry.lastActiveAt < PRESENCE_TTL_MS);
      setPresenceList(list);
    });

    return () => {
      unregisterHeartbeat();
      unsubscribeConnected();
      unsubscribeList();
      remove(presenceRef);
    };
  }, [user]);

  return useMemo(() => ({ presenceList }), [presenceList]);
};
