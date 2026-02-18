import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBoardObjects } from './useBoardObjects.js';

const mockOnValue = vi.fn();
const mockRef = vi.fn();
const mockSet = vi.fn();

vi.mock('../firebase/config.js', () => ({
  db: {},
}));

vi.mock('firebase/database', () => ({
  ref: (...args) => mockRef(...args),
  onValue: (...args) => mockOnValue(...args),
  set: (...args) => mockSet(...args),
  update: vi.fn(),
  remove: vi.fn(),
}));

describe('useBoardObjects', () => {
  beforeEach(() => {
    mockOnValue.mockReset();
    mockRef.mockReset();
    mockSet.mockReset();
  });

  it('subscribes to the board objects path and marks loaded', () => {
    const unsubscribe = vi.fn();
    mockOnValue.mockImplementation((_ref, callback) => {
      callback({ val: () => ({}) });
      return unsubscribe;
    });

    const { result, unmount } = renderHook(() => useBoardObjects({ boardName: 'test-board' }));

    expect(mockRef).toHaveBeenCalledWith({}, 'boards/test-board/objects');
    expect(result.current.objectsLoaded).toBe(true);

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('returns objects from snapshots', () => {
    const unsubscribe = vi.fn();
    mockOnValue.mockImplementation((_ref, callback) => {
      callback({ val: () => ({ obj: { id: 'obj' } }) });
      return unsubscribe;
    });

    const { result } = renderHook(() => useBoardObjects({ boardName: 'test-board' }));
    expect(result.current.objects).toEqual({ obj: { id: 'obj' } });
  });

  it('createCircle writes circle data', async () => {
    mockOnValue.mockImplementation((_ref, callback) => {
      callback({ val: () => ({}) });
      return vi.fn();
    });
    mockSet.mockResolvedValue();

    const { result } = renderHook(() => useBoardObjects({ user: { uid: 'me' }, boardName: 'test-board' }));
    await result.current.createCircle(0, 0, 1, 800, 600, 1);

    expect(mockSet).toHaveBeenCalled();
    const payload = mockSet.mock.calls[0][1];
    expect(payload.type).toBe('circle');
  });
});
