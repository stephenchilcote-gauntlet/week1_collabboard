import { useState, useEffect } from 'react';
import { auth, googleProvider } from './firebase/config.js';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSignIn = () => signInWithPopup(auth, googleProvider);
  const handleSignOut = () => signOut(auth);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '16px' }}>
        <h1>CollabBoard</h1>
        <p>Real-time collaborative whiteboard</p>
        <button onClick={handleSignIn} style={{ padding: '12px 24px', fontSize: '16px', cursor: 'pointer' }}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 100, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{user.displayName}</span>
        <button onClick={handleSignOut} style={{ padding: '4px 8px', cursor: 'pointer' }}>Sign Out</button>
      </div>
      <div style={{ width: '100%', height: '100%', background: '#f5f5f5', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: '#999' }}>Board goes here</p>
      </div>
    </div>
  );
}
