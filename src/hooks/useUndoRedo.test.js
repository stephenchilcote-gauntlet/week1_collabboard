import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from './useUndoRedo.js';

describe('useUndoRedo', () => {
  it('push adds to undo stack, undo/redo operate', async () => {
    const deleteObject = vi.fn();
    const restoreObject = vi.fn();
    const updateObject = vi.fn();
    const { result } = renderHook(() => useUndoRedo({ deleteObject, restoreObject, updateObject }));

    act(() => {
      result.current.push({ type: 'create', object: { id: 'a' } });
    });

    await act(async () => {
      await result.current.undo();
    });

    expect(deleteObject).toHaveBeenCalledWith('a');

    await act(async () => {
      await result.current.redo();
    });

    expect(restoreObject).toHaveBeenCalled();
  });

  it('undo delete restores snapshot', async () => {
    const deleteObject = vi.fn();
    const restoreObject = vi.fn();
    const updateObject = vi.fn();
    const { result } = renderHook(() => useUndoRedo({ deleteObject, restoreObject, updateObject }));

    act(() => {
      result.current.push({ type: 'delete', object: { id: 'b' } });
    });

    await act(async () => {
      await result.current.undo();
    });

    expect(restoreObject).toHaveBeenCalledWith('b', { id: 'b' });
  });

  it('undo update restores previous values', async () => {
    const deleteObject = vi.fn();
    const restoreObject = vi.fn();
    const updateObject = vi.fn();
    const { result } = renderHook(() => useUndoRedo({ deleteObject, restoreObject, updateObject }));

    act(() => {
      result.current.push({ type: 'update', objectId: 'c', before: { x: 0 }, after: { x: 20 } });
    });

    await act(async () => {
      await result.current.undo();
    });

    expect(updateObject).toHaveBeenCalledWith('c', { x: 0 });
  });

  it('redo no-op with empty stack', async () => {
    const { result } = renderHook(() => useUndoRedo({
      deleteObject: vi.fn(),
      restoreObject: vi.fn(),
      updateObject: vi.fn(),
    }));

    await act(async () => {
      await result.current.redo();
    });

    expect(result.current.redoStack).toHaveLength(0);
  });

  it('undo no-op with empty stack', async () => {
    const { result } = renderHook(() => useUndoRedo({
      deleteObject: vi.fn(),
      restoreObject: vi.fn(),
      updateObject: vi.fn(),
    }));

    await act(async () => {
      await result.current.undo();
    });

    expect(result.current.undoStack).toHaveLength(0);
  });

  it('new action clears redo stack', async () => {
    const { result } = renderHook(() => useUndoRedo({
      deleteObject: vi.fn(),
      restoreObject: vi.fn(),
      updateObject: vi.fn(),
    }));

    act(() => {
      result.current.push({ type: 'create', object: { id: 'obj-1' } });
    });

    await act(async () => {
      await result.current.undo();
    });

    act(() => {
      result.current.push({ type: 'create', object: { id: 'obj-2' } });
    });

    expect(result.current.redoStack).toHaveLength(0);
  });

  it('stack overflow evicts oldest', () => {
    const { result } = renderHook(() => useUndoRedo({
      deleteObject: vi.fn(),
      restoreObject: vi.fn(),
      updateObject: vi.fn(),
      maxSize: 50,
    }));

    act(() => {
      for (let i = 0; i < 51; i += 1) {
        result.current.push({ type: 'create', object: { id: `obj-${i}` } });
      }
    });

    expect(result.current.undoStack).toHaveLength(50);
    expect(result.current.undoStack[0].object.id).toBe('obj-1');
  });

});
