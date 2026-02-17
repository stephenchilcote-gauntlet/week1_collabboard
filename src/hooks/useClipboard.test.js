import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClipboard } from './useClipboard.js';

vi.mock('../utils/ids.js', () => ({
  generateId: vi.fn()
    .mockReturnValueOnce('new-1')
    .mockReturnValueOnce('new-2')
    .mockReturnValueOnce('new-3'),
}));

describe('useClipboard', () => {
  it('copy stores objects and paste returns cloned offsets', () => {
    const { result } = renderHook(() => useClipboard());
    const objects = [
      { id: 'a', x: 10, y: 20, width: 50, height: 60 },
      { id: 'b', x: 30, y: 40, width: 70, height: 80 },
    ];

    act(() => {
      result.current.copy(objects);
    });

    let pasted;
    act(() => {
      pasted = result.current.paste();
    });

    expect(pasted).toHaveLength(2);
    expect(pasted[0].id).toBe('new-1');
    expect(pasted[1].id).toBe('new-2');
    expect(pasted[0].x).toBe(30);
    expect(pasted[0].y).toBe(40);
  });

  it('paste with empty clipboard returns empty array', () => {
    const { result } = renderHook(() => useClipboard());
    let pasted;
    act(() => {
      pasted = result.current.paste();
    });
    expect(pasted).toEqual([]);
  });

  it('duplicate copies and pastes in one step', () => {
    const { result } = renderHook(() => useClipboard());
    const objects = [{ id: 'a', x: 0, y: 0 }];

    let duplicated;
    act(() => {
      duplicated = result.current.duplicate(objects);
    });

    expect(duplicated).toHaveLength(1);
    expect(duplicated[0].id).toBe('new-3');
    expect(duplicated[0].x).toBe(20);
    expect(duplicated[0].y).toBe(20);
  });
});
