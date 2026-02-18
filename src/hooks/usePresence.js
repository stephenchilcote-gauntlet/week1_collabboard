import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { onDisconnect, onValue, ref, remove, set, update } from 'firebase/database';
import { auth, db } from '../firebase/config.js';

const HEARTBEAT_INTERVAL_MS = 5000;
const PRESENCE_TTL_MS = 15000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];

export const usePresence = (user, boardName) => {
  const [presenceList, setPresenceList] = useState([]);
  const heartbeatRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const idleRef = useRef(false);
  const presenceRefRef = useRef(null);
  const userRef = useRef(user);
  userRef.current = user;

  const goOnline = useCallback(() => {
    const currentUser = userRef.current;
    if (!currentUser || !presenceRefRef.current) return;
    idleRef.current = false;
    lastActivityRef.current = Date.now();
    set(presenceRefRef.current, {
      uid: currentUser.uid,
      name: currentUser.displayName ?? 'Anonymous',
      photoURL: currentUser.photoURL ?? null,
      lastActiveAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setPresenceList([]);
      return undefined;
    }

    const presenceRef = ref(db, `boards/${boardName}/presence/${user.uid}`);
    presenceRefRef.current = presenceRef;
    const listRef = ref(db, `boards/${boardName}/presence`);
    const connectedRef = ref(db, '.info/connected');

    const unregisterHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    const goIdle = () => {
      idleRef.current = true;
      unregisterHeartbeat();
      remove(presenceRef);
    };

    const startHeartbeat = () => {
      unregisterHeartbeat();
      heartbeatRef.current = setInterval(() => {
        if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
          goIdle();
          return;
        }
        update(presenceRef, { lastActiveAt: Date.now() });
      }, HEARTBEAT_INTERVAL_MS);
    };

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      if (idleRef.current) {
        goOnline();
        startHeartbeat();
      }
    };

    const unsubscribeConnected = onValue(connectedRef, (snap) => {
      if (!snap.val()) return;

      lastActivityRef.current = Date.now();
      idleRef.current = false;

      set(presenceRef, {
        uid: user.uid,
        name: user.displayName ?? 'Anonymous',
        photoURL: user.photoURL ?? null,
        lastActiveAt: Date.now(),
      });
      onDisconnect(presenceRef).remove();
      startHeartbeat();
    });

    const unsubscribeList = onValue(listRef, (snapshot) => {
      const value = snapshot.val() ?? {};
      const now = Date.now();
      const list = Object.values(value)
        .filter((entry) => entry && typeof entry.lastActiveAt === 'number')
        .filter((entry) => now - entry.lastActiveAt < PRESENCE_TTL_MS);
      setPresenceList(list);
    });

    const handleVisibilityChange = () => {
      if (document.hidden) {
        goIdle();
      } else {
        handleActivity();
      }
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unregisterHeartbeat();
      unsubscribeConnected();
      unsubscribeList();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      presenceRefRef.current = null;
      if (user?.uid && auth.currentUser) {
        remove(presenceRef);
      }
    };
  }, [user, goOnline, boardName]);

  return useMemo(() => ({ presenceList }), [presenceList]);
};
