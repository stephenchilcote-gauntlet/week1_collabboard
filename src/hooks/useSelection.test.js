import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSelection } from './useSelection.js';

describe('useSelection', () => {
  it('starts with no selection', () => {
    const { result } = renderHook(() => useSelection());
    expect(result.current.selectedId).toBeNull();
  });

  it('selects an object id', () => {
    const { result } = renderHook(() => useSelection());

    act(() => {
      result.current.select('object-1');
    });

    expect(result.current.selectedId).toBe('object-1');
  });

  it('clears selection', () => {
    const { result } = renderHook(() => useSelection());

    act(() => {
      result.current.select('object-2');
    });

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedId).toBeNull();
  });
});
