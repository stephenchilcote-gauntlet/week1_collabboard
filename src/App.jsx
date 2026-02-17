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
import { useClipboard } from './hooks/useClipboard.js';
import { useUndoRedo } from './hooks/useUndoRedo.js';
import { useRotation } from './hooks/useRotation.js';
import { boardToScreen, rectFromPoints, containsRect, getObjectBounds } from './utils/coordinates.js';

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
    createCircle,
    createLine,
    createText,
    createFrame,
    createConnector,
    createObject,
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
  const clipboard = useClipboard();
  const undoRedo = useUndoRedo({ deleteObject, restoreObject, updateObject });
  const rotation = useRotation();
  const [connectorMode, setConnectorMode] = useState(false);
  const [connectorFromId, setConnectorFromId] = useState(null);
  const [marqueeBounds, setMarqueeBounds] = useState(null);
  const [marqueeStart, setMarqueeStart] = useState(null);
  const rotationStateRef = useRef(null);
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
      if (interactionState.mode === 'editing') {
        return;
      }
      if (event.key === 'Escape') {
        if (connectorMode) {
          setConnectorMode(false);
          setConnectorFromId(null);
        }
        clearSelection();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        const selected = Array.from(selection.selectedIds).map((id) => objects[id]).filter(Boolean);
        clipboard.copy(selected);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        const pasted = clipboard.paste();
        pasted.forEach((obj) => {
          createObject(obj).then((created) => {
            undoRedo.push({ type: 'create', object: created });
          });
        });
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        const selected = Array.from(selection.selectedIds).map((id) => objects[id]).filter(Boolean);
        const duplicated = clipboard.duplicate(selected);
        duplicated.forEach((obj) => {
          createObject(obj).then((created) => {
            undoRedo.push({ type: 'create', object: created });
          });
        });
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          undoRedo.redo();
        } else {
          undoRedo.undo();
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        undoRedo.redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    clearSelection,
    clipboard,
    connectorMode,
    createObject,
    interactionState.mode,
    objects,
    selection,
    undoRedo,
  ]);

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
    restoreObject(undoToast.id, undoToast.data).then(() => {
      undoRedo.push({ type: 'create', object: undoToast.data });
    }).catch(() => {
      setErrorMessage('Failed to undo deletion.');
    });
    setUndoToast(null);
  }, [undoToast, restoreObject, undoRedo]);

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
    ).then((sticky) => {
      undoRedo.push({ type: 'create', object: sticky });
    }).catch(() => {
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
    ).then((rectangle) => {
      undoRedo.push({ type: 'create', object: rectangle });
    }).catch(() => {
      setErrorMessage('Failed to create rectangle.');
    });
  };

  const handleCreateCircle = () => {
    createCircle(
      viewport.panX,
      viewport.panY,
      viewport.zoom,
      viewport.viewportWidth,
      viewport.viewportHeight,
      sortedZIndex + 1,
    ).then((circle) => {
      undoRedo.push({ type: 'create', object: circle });
    }).catch(() => {
      setErrorMessage('Failed to create circle.');
    });
  };

  const handleCreateLine = () => {
    createLine(
      viewport.panX,
      viewport.panY,
      viewport.zoom,
      viewport.viewportWidth,
      viewport.viewportHeight,
      sortedZIndex + 1,
    ).then((line) => {
      undoRedo.push({ type: 'create', object: line });
    }).catch(() => {
      setErrorMessage('Failed to create line.');
    });
  };

  const handleCreateText = () => {
    createText(
      viewport.panX,
      viewport.panY,
      viewport.zoom,
      viewport.viewportWidth,
      viewport.viewportHeight,
      sortedZIndex + 1,
    ).then((text) => {
      undoRedo.push({ type: 'create', object: text });
    }).catch(() => {
      setErrorMessage('Failed to create text.');
    });
  };

  const handleCreateFrame = () => {
    createFrame(
      viewport.panX,
      viewport.panY,
      viewport.zoom,
      viewport.viewportWidth,
      viewport.viewportHeight,
      (sortedZIndex ?? 0) - 1,
    ).then((frame) => {
      undoRedo.push({ type: 'create', object: frame });
    }).catch(() => {
      setErrorMessage('Failed to create frame.');
    });
  };

  const handleEnterConnectorMode = () => {
    setConnectorMode((prev) => !prev);
    setConnectorFromId(null);
  };

  const handleConnectorCandidate = (objectId) => {
    if (!connectorMode) {
      return;
    }
    if (!connectorFromId) {
      setConnectorFromId(objectId);
      return;
    }
    if (connectorFromId === objectId) {
      return;
    }
    const fromZ = objects[connectorFromId]?.zIndex ?? 0;
    const toZ = objects[objectId]?.zIndex ?? 0;
    createConnector(connectorFromId, objectId, 'line', Math.min(fromZ, toZ) - 1)
      .then((connector) => {
        undoRedo.push({ type: 'create', object: connector });
      })
      .catch(() => {
        setErrorMessage('Failed to create connector.');
      })
      .finally(() => {
        setConnectorFromId(null);
        setConnectorMode(false);
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
        undoRedo.push({ type: 'delete', object: savedData });
      }
    }).catch(() => {
      setErrorMessage('Failed to delete object.');
    });
  };

  const handleUpdateObject = (objectId, updates, recordUndo = true) => {
    if (!objects[objectId]) {
      return;
    }
    if (recordUndo) {
      undoRedo.push({
        type: 'update',
        objectId,
        before: objects[objectId],
        after: { ...objects[objectId], ...updates },
      });
    }
    updateObject(objectId, updates).catch(() => {
      setErrorMessage('Failed to update object.');
    });
  };

  const handleUpdateObjectNoUndo = useCallback((objectId, updates) => {
    if (!objects[objectId]) {
      return;
    }
    updateObject(objectId, updates).catch(() => {
      setErrorMessage('Failed to update object.');
    });
  }, [objects, updateObject]);

  const handleDragStart = (object, containerX, containerY) => {
    let selectedObjects = selection.selectedIds.size > 1
      ? Array.from(selection.selectedIds).map((id) => objects[id]).filter(Boolean)
      : null;

    if (object.type === 'frame' && !selectedObjects) {
      const frameBounds = getObjectBounds(object);
      const children = Object.values(objects ?? {}).filter((obj) => {
        if (obj.id === object.id) return false;
        const objBounds = getObjectBounds(obj);
        return containsRect(frameBounds, objBounds);
      });
      if (children.length > 0) {
        selectedObjects = [object, ...children];
        selection.setSelection(selectedObjects.map((o) => o.id));
      }
    }

    dragStart(object, containerX, containerY, selectedObjects);
    handleUpdateObject(object.id, { zIndex: sortedZIndex + 1 });
    if (selectedObjects) {
      selectedObjects.forEach((item) => {
        undoRedo.push({
          type: 'update',
          objectId: item.id,
          before: { x: item.x, y: item.y, x1: item.x1, y1: item.y1, x2: item.x2, y2: item.y2 },
          after: { x: item.x, y: item.y, x1: item.x1, y1: item.y1, x2: item.x2, y2: item.y2 },
        });
      });
    }
  };

  const handleResizeStartWithZ = (object, handlePosition, containerX, containerY) => {
    const selectionBounds = selection.getSelectionBounds?.();
    const groupItems = selection.selectedIds.size > 1
      ? Array.from(selection.selectedIds).map((id) => objects[id]).filter(Boolean)
      : null;
    resizeStart(object, handlePosition, containerX, containerY, {
      keepAspect: object.type === 'circle' && ['nw', 'ne', 'sw', 'se'].includes(handlePosition),
      symmetric: object.type === 'circle',
      groupBounds: groupItems ? selectionBounds : null,
      groupItems,
    });
    handleUpdateObject(object.id, { zIndex: sortedZIndex + 1 });
    if (groupItems) {
      groupItems.forEach((item) => {
        undoRedo.push({
          type: 'update',
          objectId: item.id,
          before: { x: item.x, y: item.y, width: item.width, height: item.height },
          after: { x: item.x, y: item.y, width: item.width, height: item.height },
        });
      });
    }
  };

  const handleEditStateChange = (objectId, isEditing) => {
    interactionState.setMode(isEditing ? 'editing' : 'idle', objectId);
  };

  const handleRotationStart = (object, containerX, containerY) => {
    const center = {
      x: object.x + (object.width ?? 0) / 2,
      y: object.y + (object.height ?? 0) / 2,
    };
    const pointer = {
      x: containerX / viewport.zoom - viewport.panX,
      y: containerY / viewport.zoom - viewport.panY,
    };
    rotation.startRotation(center, pointer, object.rotation ?? 0);
    rotationStateRef.current = { id: object.id };
    undoRedo.push({
      type: 'update',
      objectId: object.id,
      before: { rotation: object.rotation ?? 0 },
      after: { rotation: object.rotation ?? 0 },
    });
  };

  const handleRotationMove = (containerX, containerY) => {
    if (!rotationStateRef.current) {
      return;
    }
    const pointer = {
      x: containerX / viewport.zoom - viewport.panX,
      y: containerY / viewport.zoom - viewport.panY,
    };
    const angle = rotation.updateRotation(pointer);
    const normalized = rotation.normalizeAngle(angle);
    handleUpdateObjectNoUndo(rotationStateRef.current.id, { rotation: normalized });
  };

  const handleRotationEnd = () => {
    rotationStateRef.current = null;
  };

  const handleMarqueeStart = (containerX, containerY) => {
    const start = {
      x: containerX / viewport.zoom - viewport.panX,
      y: containerY / viewport.zoom - viewport.panY,
    };
    setMarqueeStart(start);
    setMarqueeBounds({ x: start.x, y: start.y, width: 0, height: 0 });
    interactionState.setMode('selecting');
  };

  const handleMarqueeMove = (containerX, containerY) => {
    if (!marqueeStart) {
      return;
    }
    const current = {
      x: containerX / viewport.zoom - viewport.panX,
      y: containerY / viewport.zoom - viewport.panY,
    };
    setMarqueeBounds(rectFromPoints(marqueeStart, current));
  };

  const handleMarqueeEnd = () => {
    if (marqueeBounds) {
      const ids = selection.getIntersectingIds(objects, marqueeBounds);
      selection.setSelection(ids);
    }
    setMarqueeBounds(null);
    setMarqueeStart(null);
    interactionState.setMode('idle');
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
        onCreateCircle={handleCreateCircle}
        onCreateLine={handleCreateLine}
        onCreateText={handleCreateText}
        onCreateFrame={handleCreateFrame}
        onEnterConnectorMode={handleEnterConnectorMode}
        onDeleteSelected={handleDeleteSelected}
        selectedId={selection.selectedId}
        interactionMode={interactionState.mode}
        connectorMode={connectorMode}
        connectorFromId={connectorFromId}
      />
      {connectorMode && (
        <div style={{
          position: 'fixed',
          top: 16,
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
          <span>{connectorFromId ? 'Connector mode: Click second object' : 'Connector mode: Click first object'}</span>
          <button
            onClick={() => { setConnectorMode(false); setConnectorFromId(null); }}
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
            Cancel (Esc)
          </button>
        </div>
      )}
      {(() => {
        const selObj = selection.selectedId ? objects?.[selection.selectedId] : null;
        if (!selObj) return null;
        const { panX, panY, zoom } = viewport;
        const bounds = getObjectBounds(selObj);
        const screenPos = boardToScreen(bounds.x, bounds.y + bounds.height, panX, panY, zoom);
        const paletteHeight = 50;
        const showAbove = screenPos.y + 8 + paletteHeight > viewport.viewportHeight;
        const topPos = showAbove
          ? screenPos.y - bounds.height * zoom - paletteHeight
          : screenPos.y + 8;
        return (
          <div style={{
            position: 'absolute',
            left: screenPos.x,
            top: topPos,
            zIndex: 160,
            transform: 'translateX(-50%)',
            marginLeft: (bounds.width * zoom) / 2,
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
        selectedIds={selection.selectedIds}
        draggingId={interactionState.mode === 'dragging' ? interactionState.activeObjectId : null}
        lockedObjectIds={selection.lockedObjectIds}
        onSelect={selection.select}
        onToggleSelect={selection.toggleSelection}
        onClearSelection={handleClearSelection}
        onUpdateObject={handleUpdateObject}
        onEditingChange={handleEditStateChange}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onResizeStart={handleResizeStartWithZ}
        onResizeMove={handleResizeMove}
        onResizeEnd={handleResizeEnd}
        onConnectorCandidate={handleConnectorCandidate}
        connectorMode={connectorMode}
        connectorFromId={connectorFromId}
        selectionBounds={selection.getSelectionBounds?.()}
        marqueeBounds={marqueeBounds}
        onMarqueeStart={handleMarqueeStart}
        onMarqueeMove={handleMarqueeMove}
        onMarqueeEnd={handleMarqueeEnd}
        onRotationStart={handleRotationStart}
        onRotationMove={handleRotationMove}
        onRotationEnd={handleRotationEnd}
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
