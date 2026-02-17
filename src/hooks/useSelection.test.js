import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelection } from './useSelection.js';

const mockOnValue = vi.fn();
const mockRef = vi.fn();
const mockSet = vi.fn();
const mockRemove = vi.fn();
const mockOnDisconnect = vi.fn(() => ({ remove: vi.fn(), cancel: vi.fn() }));

vi.mock('../firebase/config.js', () => ({
  db: {},
  BOARD_ID: 'default',
}));

vi.mock('firebase/database', () => ({
  ref: (...args) => mockRef(...args),
  onValue: (...args) => mockOnValue(...args),
  set: (...args) => mockSet(...args),
  remove: (...args) => mockRemove(...args),
  onDisconnect: (...args) => mockOnDisconnect(...args),
}));

describe('useSelection', () => {
  beforeEach(() => {
    mockOnValue.mockReset();
    mockRef.mockReset();
    mockSet.mockReset();
    mockRemove.mockReset();
    mockOnDisconnect.mockReset().mockReturnValue({ remove: vi.fn(), cancel: vi.fn() });
    // Default: remote selections subscription returns empty
    mockOnValue.mockImplementation((_ref, callback) => {
      callback({ val: () => ({}) });
      return vi.fn();
    });
  });

  it('starts with no selection', () => {
    const { result } = renderHook(() => useSelection());
    expect(result.current.selectedId).toBeNull();
  });

  it('selects an object id', () => {
    const { result } = renderHook(() => useSelection({ 'object-1': { id: 'object-1' } }));

    act(() => {
      result.current.select('object-1');
    });

    expect(result.current.selectedId).toBe('object-1');
  });

  it('clears selection', () => {
    const { result } = renderHook(() => useSelection({}));

    act(() => {
      result.current.select('object-2');
    });

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedId).toBeNull();
  });

  it('clears selection when object is removed', () => {
    const { result, rerender } = renderHook(({ objects }) => useSelection(objects), {
      initialProps: { objects: { obj: { id: 'obj' } } },
    });

    act(() => {
      result.current.select('obj');
    });

    rerender({ objects: {} });
    expect(result.current.selectedId).toBeNull();
  });

  it('returns empty lockedObjectIds when no user', () => {
    const { result } = renderHook(() => useSelection({}, null));
    expect(result.current.lockedObjectIds).toEqual({});
  });

  it('computes lockedObjectIds from remote selections of present users', () => {
    const user = { uid: 'me', displayName: 'Me' };
    const presenceList = [
      { uid: 'me', name: 'Me' },
      { uid: 'other_user', name: 'Alice' },
    ];
    mockOnValue.mockImplementation((_ref, callback) => {
      callback({
        val: () => ({
          other_user: { objectId: 'note-1', name: 'Alice' },
          me: { objectId: 'note-2', name: 'Me' },
        }),
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useSelection({}, user, presenceList));

    // note-1 is locked by another present user
    expect(result.current.lockedObjectIds).toEqual({
      'note-1': { uid: 'other_user', name: 'Alice' },
    });
    // note-2 is our own selection, not locked
    expect(result.current.lockedObjectIds['note-2']).toBeUndefined();
  });

  it('ignores selections from users no longer present', () => {
    const user = { uid: 'me', displayName: 'Me' };
    const presenceList = [{ uid: 'me', name: 'Me' }]; // other_user NOT present
    mockOnValue.mockImplementation((_ref, callback) => {
      callback({
        val: () => ({
          other_user: { objectId: 'note-1', name: 'Alice' },
        }),
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useSelection({}, user, presenceList));

    expect(result.current.lockedObjectIds).toEqual({});
  });

  it('syncs selection to Firebase when user is present', () => {
    const user = { uid: 'me', displayName: 'Me' };
    const { result } = renderHook(() => useSelection({}, user));

    act(() => {
      result.current.select('note-1');
    });

    expect(mockSet).toHaveBeenCalledWith(
      undefined,
      { objectId: 'note-1', name: 'Me' },
    );
  });

  it('removes selection from Firebase on clearSelection', () => {
    const user = { uid: 'me', displayName: 'Me' };
    const { result } = renderHook(() => useSelection({}, user));

    act(() => {
      result.current.select('note-1');
    });

    act(() => {
      result.current.clearSelection();
    });

    // remove is called: once during initial mount (no selection), once on clearSelection
    const removeCalls = mockRemove.mock.calls;
    expect(removeCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('refuses to select an object locked by another user', () => {
    const user = { uid: 'me', displayName: 'Me' };
    const presenceList = [{ uid: 'me', name: 'Me' }, { uid: 'other_user', name: 'Alice' }];
    mockOnValue.mockImplementation((_ref, callback) => {
      callback({
        val: () => ({
          other_user: { objectId: 'note-1', name: 'Alice' },
        }),
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useSelection({ 'note-1': { id: 'note-1' } }, user, presenceList));

    act(() => {
      result.current.select('note-1');
    });

    expect(result.current.selectedId).toBeNull();
  });

  it('deselects if another user locks the currently selected object', () => {
    const user = { uid: 'me', displayName: 'Me' };
    const presenceList = [{ uid: 'me', name: 'Me' }, { uid: 'other_user', name: 'Alice' }];
    let selectionsCallback;
    mockOnValue.mockImplementation((_ref, callback) => {
      // The first onValue call is for selections, the rest are .info/connected etc.
      if (!selectionsCallback) {
        selectionsCallback = callback;
        callback({ val: () => ({}) });
      } else {
        // .info/connected: fire as connected
        callback({ val: () => true });
      }
      return vi.fn();
    });

    const { result } = renderHook(() => useSelection({ 'note-1': { id: 'note-1' } }, user, presenceList));

    act(() => {
      result.current.select('note-1');
    });
    expect(result.current.selectedId).toBe('note-1');

    // Simulate remote user selecting the same object
    act(() => {
      selectionsCallback({
        val: () => ({
          other_user: { objectId: 'note-1', name: 'Alice' },
          me: { objectId: 'note-1', name: 'Me' },
        }),
      });
    });

    expect(result.current.selectedId).toBeNull();
  });

  it('sets up onDisconnect via .info/connected', () => {
    const disconnectRemove = vi.fn();
    mockOnDisconnect.mockReturnValue({ remove: disconnectRemove, cancel: vi.fn() });
    const user = { uid: 'me', displayName: 'Me' };

    // Simulate .info/connected firing true
    mockOnValue.mockImplementation((_ref, callback) => {
      callback({ val: () => true });
      return vi.fn();
    });

    renderHook(() => useSelection({}, user));

    expect(mockOnDisconnect).toHaveBeenCalled();
    expect(disconnectRemove).toHaveBeenCalled();
  });
});
