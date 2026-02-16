import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewport } from './useViewport.js';
import { screenToBoard } from '../utils/coordinates.js';

const createBoardRef = () => ({
  current: {
    clientWidth: 800,
    clientHeight: 600,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
});

describe('useViewport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with neutral pan and zoom', () => {
    const boardRef = createBoardRef();
    const { result } = renderHook(() => useViewport(boardRef));
    expect(result.current.panX).toBe(0);
    expect(result.current.panY).toBe(0);
    expect(result.current.zoom).toBe(1);
  });

  it('pans additively in board space', () => {
    const boardRef = createBoardRef();
    const { result } = renderHook(() => useViewport(boardRef));

    act(() => {
      result.current.handlePanStart(0, 0, 1);
    });
    act(() => {
      result.current.handlePanMove(20, 10);
    });
    act(() => {
      result.current.handlePanMove(40, 30);
    });
    act(() => {
      result.current.handlePanEnd(1);
    });

    expect(result.current.panX).toBeCloseTo(40, 5);
    expect(result.current.panY).toBeCloseTo(30, 5);
  });

  it('anchors zoom to the cursor position', () => {
    const boardRef = createBoardRef();
    const { result } = renderHook(() => useViewport(boardRef));

    const cursor = { x: 100, y: 150 };
    const before = screenToBoard(cursor.x, cursor.y, result.current.panX, result.current.panY, result.current.zoom);

    act(() => {
      result.current.handleZoom(-100, cursor.x, cursor.y);
    });

    const after = screenToBoard(cursor.x, cursor.y, result.current.panX, result.current.panY, result.current.zoom);

    expect(after.x).toBeCloseTo(before.x, 3);
    expect(after.y).toBeCloseTo(before.y, 3);
  });

  it('tracks viewport dimensions', () => {
    const boardRef = createBoardRef();
    const { result } = renderHook(() => useViewport(boardRef));

    expect(result.current.viewportWidth).toBe(800);
    expect(result.current.viewportHeight).toBe(600);
  });
});
