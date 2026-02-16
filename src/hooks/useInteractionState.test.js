import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInteractionState } from './useInteractionState.js';

describe('useInteractionState', () => {
  it('starts idle with no active object', () => {
    const { result } = renderHook(() => useInteractionState());
    expect(result.current.mode).toBe('idle');
    expect(result.current.activeObjectId).toBeNull();
  });

  it('sets mode and active object id', () => {
    const { result } = renderHook(() => useInteractionState());

    act(() => {
      result.current.setMode('dragging', 'object-1');
    });

    expect(result.current.mode).toBe('dragging');
    expect(result.current.activeObjectId).toBe('object-1');
  });

  it('resets to idle when setMode idle', () => {
    const { result } = renderHook(() => useInteractionState());

    act(() => {
      result.current.setMode('resizing', 'object-2');
    });

    act(() => {
      result.current.setMode('idle');
    });

    expect(result.current.mode).toBe('idle');
    expect(result.current.activeObjectId).toBeNull();
  });
});
