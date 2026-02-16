import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../firebase/config.js';

export default function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const infoRef = ref(db, '.info/connected');
    const unsubscribe = onValue(infoRef, (snapshot) => {
      setIsConnected(Boolean(snapshot.val()));
    });

    return () => unsubscribe();
  }, []);

  if (isConnected) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: '8px 12px',
        background: '#F59E0B',
        color: '#1f2937',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 200,
        pointerEvents: 'none',
      }}
    >
      <span aria-hidden="true">⚠</span>
      <span>Connection lost — reconnecting…</span>
    </div>
  );
}
