import { useMemo, useRef, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { ref, remove } from 'firebase/database';
import { auth, googleProvider, db, BOARD_ID } from './firebase/config.js';
import Board from './components/Board.jsx';
import ConnectionStatus from './components/ConnectionStatus.jsx';
import CursorOverlay from './components/CursorOverlay.jsx';
import PresenceBar from './components/PresenceBar.jsx';
import Toolbar from './components/Toolbar.jsx';
import ColorPalette from './components/ColorPalette.jsx';
import ErrorBanner from './components/ErrorBanner.jsx';
import { useViewport } from './hooks/useViewport.js';
import { useBoardObjects } from './hooks/useBoardObjects.js';
import { useDrag } from './hooks/useDrag.js';
import { useResize } from './hooks/useResize.js';
import { useSelection } from './hooks/useSelection.js';
import { useCursors } from './hooks/useCursors.js';
import { usePresence } from './hooks/usePresence.js';
import { useInteractionState } from './hooks/useInteractionState.js';

const BoardShell = ({ user }) => {
  const [errorMessage, setErrorMessage] = useState('');
  const boardRef = useRef(null);
  const viewport = useViewport(boardRef);
  const interactionState = useInteractionState();
  const {
    objects,
    objectsLoaded,
    updateObject,
    createStickyNote,
    createRectangle,
    deleteObject,
    localCreatedIds,
  } = useBoardObjects({
    user,
    draggingId: interactionState.mode === 'dragging' ? interactionState.activeObjectId : null,
    editingId: interactionState.mode === 'editing' ? interactionState.activeObjectId : null,
  });
  const selection = useSelection(objects);
  const {
    handleDragStart: dragStart,
    handleDragMove,
    handleDragEnd,
  } = useDrag(
    viewport,
    updateObject,
    selection.select,
    (dragId) => interactionState.setMode(dragId ? 'dragging' : 'idle', dragId),
  );
  const {
    handleResizeStart: resizeStart,
    handleResizeMove,
    handleResizeEnd,
  } = useResize(
    viewport,
    updateObject,
    (resizeId) => interactionState.setMode(resizeId ? 'resizing' : 'idle', resizeId),
  );
  const { cursors, updateCursor } = useCursors(user);
  const { presenceList } = usePresence(user);

  const sortedZIndex = useMemo(() => {
    return Object.values(objects ?? {}).reduce((max, object) => (
      Math.max(max, object.zIndex ?? 0)
    ), 0);
  }, [objects]);

  const handleSignOut = async () => {
    const cursorRef = ref(db, `boards/${BOARD_ID}/cursors/${user.uid}`);
    const presenceRef = ref(db, `boards/${BOARD_ID}/presence/${user.uid}`);
    try {
      await remove(cursorRef);
      await remove(presenceRef);
    } catch (error) {
      setErrorMessage('Unable to clean up session. Signing out anyway.');
    }
    await signOut(auth);
  };

  const handleClearSelection = () => {
    selection.clearSelection();
  };

  const handleCreateSticky = () => {
    createStickyNote(
      viewport.panX,
      viewport.panY,
      viewport.zoom,
      viewport.viewportWidth,
      viewport.viewportHeight,
      sortedZIndex + 1,
    ).catch(() => {
      setErrorMessage('Failed to create sticky note.');
    });
  };

  const handleCreateRectangle = () => {
    createRectangle(
      viewport.panX,
      viewport.panY,
      viewport.zoom,
      viewport.viewportWidth,
      viewport.viewportHeight,
      sortedZIndex + 1,
    ).catch(() => {
      setErrorMessage('Failed to create rectangle.');
    });
  };

  const handleDeleteSelected = (objectId) => {
    if (!objectId) {
      return;
    }
    deleteObject(objectId).catch(() => {
      setErrorMessage('Failed to delete object.');
    });
  };

  const handleUpdateObject = (objectId, updates) => {
    updateObject(objectId, updates).catch(() => {
      setErrorMessage('Failed to update object.');
    });
  };

  const handleDragStart = (object, containerX, containerY) => {
    dragStart(object, containerX, containerY);
    handleUpdateObject(object.id, { zIndex: sortedZIndex + 1 });
  };

  const handleResizeStartWithZ = (object, handlePosition, containerX, containerY) => {
    resizeStart(object, handlePosition, containerX, containerY);
    handleUpdateObject(object.id, { zIndex: sortedZIndex + 1 });
  };

  const handleEditStateChange = (objectId, isEditing) => {
    interactionState.setMode(isEditing ? 'editing' : 'idle', objectId);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ConnectionStatus />
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 100, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{user.displayName}</span>
        <button onClick={handleSignOut} style={{ padding: '4px 8px', cursor: 'pointer' }}>Sign Out</button>
      </div>
      <PresenceBar presenceList={presenceList} currentUid={user.uid} />
      <Toolbar
        onCreateSticky={handleCreateSticky}
        onCreateRectangle={handleCreateRectangle}
        onDeleteSelected={handleDeleteSelected}
        selectedId={selection.selectedId}
        interactionMode={interactionState.mode}
      />
      <div style={{ position: 'fixed', left: 12, top: 'calc(50% + 140px)', zIndex: 160 }}>
        <ColorPalette
          selectedObject={selection.selectedId ? objects?.[selection.selectedId] : null}
          onChangeColor={handleUpdateObject}
        />
      </div>
      <Board
        boardRef={boardRef}
        viewport={viewport}
        objects={objects}
        objectsLoaded={objectsLoaded}
        user={user}
        localCreatedIds={localCreatedIds}
        selectedId={selection.selectedId}
        onSelect={selection.select}
        onClearSelection={handleClearSelection}
        onUpdateObject={handleUpdateObject}
        onEditingChange={handleEditStateChange}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onResizeStart={handleResizeStartWithZ}
        onResizeMove={handleResizeMove}
        onResizeEnd={handleResizeEnd}
        onCursorMove={(x, y) => updateCursor(x, y, viewport.panX, viewport.panY, viewport.zoom)}
      />
      <CursorOverlay cursors={cursors} viewport={viewport} />
      {errorMessage && (
        <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage('')} />
      )}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signInError, setSignInError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSignIn = () => {
    setSignInError('');
    signInWithPopup(auth, googleProvider).catch((error) => {
      setSignInError(error.message || 'Unable to sign in. Please try again.');
    });
  };

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
        {signInError && (
          <ErrorBanner message={signInError} onDismiss={() => setSignInError('')} />
        )}
      </div>
    );
  }

  return <BoardShell user={user} />;
}
