import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
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
import { boardToScreen } from './utils/coordinates.js';

const BoardShell = ({ user }) => {
  const [errorMessage, setErrorMessage] = useState('');
  const [signOutHovered, setSignOutHovered] = useState(false);
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
    restoreObject,
    localCreatedIds,
  } = useBoardObjects({
    user,
    draggingId: interactionState.mode === 'dragging' ? interactionState.activeObjectId : null,
    editingId: interactionState.mode === 'editing' ? interactionState.activeObjectId : null,
  });
  const { cursors, updateCursor } = useCursors(user);
  const { presenceList } = usePresence(user);
  const selection = useSelection(objects, user, presenceList);
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

  const clearSelection = selection.clearSelection;
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection]);

  const [undoToast, setUndoToast] = useState(null);
  const undoTimerRef = useRef(null);

  useEffect(() => {
    if (!undoToast) return;
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 5000);
    return () => clearTimeout(undoTimerRef.current);
  }, [undoToast]);

  const handleUndo = useCallback(() => {
    if (!undoToast) return;
    clearTimeout(undoTimerRef.current);
    restoreObject(undoToast.id, undoToast.data).catch(() => {
      setErrorMessage('Failed to undo deletion.');
    });
    setUndoToast(null);
  }, [undoToast, restoreObject]);

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
    const savedData = objects[objectId];
    deleteObject(objectId).then(() => {
      if (savedData) {
        setUndoToast({ id: objectId, data: savedData, type: savedData.type ?? 'object' });
      }
    }).catch(() => {
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
        <button
          onClick={handleSignOut}
          onMouseEnter={() => setSignOutHovered(true)}
          onMouseLeave={() => setSignOutHovered(false)}
          style={{
            padding: '4px 8px',
            cursor: 'pointer',
            background: signOutHovered ? 'rgba(0,0,0,0.08)' : 'transparent',
            borderRadius: 8,
            transition: 'background 0.15s',
          }}
        >Sign Out</button>
      </div>
      <PresenceBar presenceList={presenceList} currentUid={user.uid} />
      <Toolbar
        onCreateSticky={handleCreateSticky}
        onCreateRectangle={handleCreateRectangle}
        onDeleteSelected={handleDeleteSelected}
        selectedId={selection.selectedId}
        interactionMode={interactionState.mode}
      />
      {(() => {
        const selObj = selection.selectedId ? objects?.[selection.selectedId] : null;
        if (!selObj) return null;
        const { panX, panY, zoom } = viewport;
        const screenPos = boardToScreen(selObj.x, selObj.y + (selObj.height ?? 0), panX, panY, zoom);
        const paletteHeight = 50;
        const showAbove = screenPos.y + 8 + paletteHeight > viewport.viewportHeight;
        const topPos = showAbove
          ? screenPos.y - (selObj.height ?? 0) * zoom - paletteHeight
          : screenPos.y + 8;
        return (
          <div style={{
            position: 'absolute',
            left: screenPos.x,
            top: topPos,
            zIndex: 160,
            transform: 'translateX(-50%)',
            marginLeft: ((selObj.width ?? 0) * zoom) / 2,
          }}>
            <ColorPalette
              selectedObject={selObj}
              onChangeColor={handleUpdateObject}
            />
          </div>
        );
      })()}
      <Board
        boardRef={boardRef}
        viewport={viewport}
        objects={objects}
        objectsLoaded={objectsLoaded}
        user={user}
        localCreatedIds={localCreatedIds}
        selectedId={selection.selectedId}
        lockedObjectIds={selection.lockedObjectIds}
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
      <CursorOverlay cursors={cursors} viewport={viewport} currentUid={user.uid} />
      <div style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'rgba(255,255,255,0.75)',
        borderRadius: 8,
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        padding: '2px 4px',
        fontSize: 12,
        color: '#6b7280',
        userSelect: 'none',
      }}>
        <button
          onClick={() => viewport.handleZoom(1, viewport.viewportWidth / 2, viewport.viewportHeight / 2)}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 14,
            color: '#6b7280',
            padding: '2px 6px',
            borderRadius: 4,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#e5e7eb'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          −
        </button>
        <button
          onClick={() => viewport.resetZoom()}
          title="Reset zoom"
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 12,
            color: '#6b7280',
            minWidth: 36,
            textAlign: 'center',
            padding: '2px 4px',
            borderRadius: 4,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#e5e7eb'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {viewport.zoomPercent}%
        </button>
        <button
          onClick={() => viewport.handleZoom(-1, viewport.viewportWidth / 2, viewport.viewportHeight / 2)}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 14,
            color: '#6b7280',
            padding: '2px 6px',
            borderRadius: 4,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#e5e7eb'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          +
        </button>
      </div>
      {errorMessage && (
        <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage('')} />
      )}
      {undoToast && (
        <div style={{
          position: 'fixed',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 210,
          background: 'rgba(17, 24, 39, 0.9)',
          color: '#f9fafb',
          padding: '10px 16px',
          borderRadius: 10,
          fontSize: 13,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span>Deleted {undoToast.type}</span>
          <button
            onClick={handleUndo}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#93c5fd',
              padding: '4px 12px',
              borderRadius: 6,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.color = '#bfdbfe';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#93c5fd';
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
};

const getFirebaseAuthTroubleshooting = () => (
  'Sign-in is not configured for this Firebase project. '
  + 'Enable Google in Firebase Console > Authentication > Sign-in method, '
  + 'add your Hosting domain (ex: collabboard-g4-sjc.web.app) and localhost to Authorized domains, '
  + 'then restart the dev server.'
);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signInError, setSignInError] = useState('');
  const [signInHovered, setSignInHovered] = useState(false);

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
      if (error?.code === 'auth/configuration-not-found') {
        setSignInError(getFirebaseAuthTroubleshooting());
        return;
      }
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
        <button
          onClick={handleSignIn}
          onMouseEnter={() => setSignInHovered(true)}
          onMouseLeave={() => setSignInHovered(false)}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            cursor: 'pointer',
            background: signInHovered ? 'rgba(0,0,0,0.08)' : 'transparent',
            borderRadius: 8,
            transition: 'background 0.15s',
          }}
        >
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
