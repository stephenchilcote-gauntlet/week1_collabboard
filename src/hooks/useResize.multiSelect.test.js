import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResize } from './useResize.js';

// Three objects laid out horizontally
const makeGroupItems = () => [
  { id: 'a', x: 0, y: 0, width: 100, height: 100 },
  { id: 'b', x: 150, y: 0, width: 100, height: 100 },
  { id: 'c', x: 300, y: 0, width: 100, height: 100 },
];

const groupBounds = { x: 0, y: 0, width: 400, height: 100 };

// The "object" passed to handleResizeStart for multi-select (synthetic target with
// the same bounds as the group selection)
const multiTarget = { id: '__multi__', x: 0, y: 0, width: 400, height: 100 };

const viewport = { panX: 0, panY: 0, zoom: 1 };

describe('useResize multi-select group scaling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates ALL items when scaling a group via east handle', () => {
    const updateObject = vi.fn();
    const { result } = renderHook(() => useResize(viewport, updateObject));

    act(() => {
      result.current.handleResizeStart(multiTarget, 'e', 400, 50, {
        groupBounds,
        groupItems: makeGroupItems(),
      });
    });

    // Advance timers so resizingId state updates and handleResizeMove sees it
    act(() => { vi.advanceTimersByTime(0); });

    // Simulate dragging the east handle 100px to the right (in board coords)
    // screenToBoard with panX=0, panY=0, zoom=1 is identity,
    // so container coords = board coords.
    // startPointer = (400, 50), current = (500, 50) → dx=100, dy=0
    act(() => {
      result.current.handleResizeMove(500, 50);
    });

    // Flush any pending throttled updates
    act(() => { vi.advanceTimersByTime(100); });

    // All 3 items should have been updated
    const updatedIds = updateObject.mock.calls.map((call) => call[0]);
    expect(updatedIds).toContain('a');
    expect(updatedIds).toContain('b');
    expect(updatedIds).toContain('c');
  });

  it('scales positions proportionally for all items', () => {
    const updateObject = vi.fn();
    const { result } = renderHook(() => useResize(viewport, updateObject));

    act(() => {
      result.current.handleResizeStart(multiTarget, 'e', 400, 50, {
        groupBounds,
        groupItems: makeGroupItems(),
      });
    });

    act(() => { vi.advanceTimersByTime(0); });

    // Drag east handle from 400 to 600 → dx=200, new width = 600
    // scaleX = 600/400 = 1.5
    act(() => {
      result.current.handleResizeMove(600, 50);
    });

    act(() => { vi.advanceTimersByTime(100); });

    // Collect the last update for each item id
    const updates = {};
    updateObject.mock.calls.forEach(([id, data]) => {
      updates[id] = data;
    });

    // Item A: center (50,50), newCx = 0 + 50 * 1.5 = 75, x = 75 - 50 = 25
    // Item B: center (200,50), newCx = 0 + 200 * 1.5 = 300, x = 300 - 50 = 250
    // Item C: center (350,50), newCx = 0 + 350 * 1.5 = 525, x = 525 - 50 = 475
    expect(updates.a).toBeDefined();
    expect(updates.b).toBeDefined();
    expect(updates.c).toBeDefined();
    expect(updates.a.x).toBeCloseTo(25, 1);
    expect(updates.b.x).toBeCloseTo(250, 1);
    expect(updates.c.x).toBeCloseTo(475, 1);
    // Y values should stay the same (scaleY = 1, bounds.y = 0)
    expect(updates.a.y).toBeCloseTo(0, 1);
    expect(updates.b.y).toBeCloseTo(0, 1);
    expect(updates.c.y).toBeCloseTo(0, 1);
  });

  it('does not change item sizes (only positions)', () => {
    const updateObject = vi.fn();
    const { result } = renderHook(() => useResize(viewport, updateObject));

    act(() => {
      result.current.handleResizeStart(multiTarget, 'se', 400, 100, {
        groupBounds,
        groupItems: makeGroupItems(),
      });
    });

    act(() => { vi.advanceTimersByTime(0); });

    act(() => {
      result.current.handleResizeMove(600, 200);
    });

    act(() => { vi.advanceTimersByTime(100); });

    updateObject.mock.calls.forEach(([, data]) => {
      expect(data).not.toHaveProperty('width');
      expect(data).not.toHaveProperty('height');
    });
  });

  it('handles west handle (items shift with bounds origin)', () => {
    const updateObject = vi.fn();
    const { result } = renderHook(() => useResize(viewport, updateObject));

    act(() => {
      result.current.handleResizeStart(multiTarget, 'w', 0, 50, {
        groupBounds,
        groupItems: makeGroupItems(),
      });
    });

    act(() => { vi.advanceTimersByTime(0); });

    // Drag west handle from 0 to -100 → dx=-100
    // West handle: left moves from 0 to -100, width becomes 500
    // scaleX = 500/400 = 1.25
    act(() => {
      result.current.handleResizeMove(-100, 50);
    });

    act(() => { vi.advanceTimersByTime(100); });

    const updates = {};
    updateObject.mock.calls.forEach(([id, data]) => {
      updates[id] = data;
    });

    // Item A center (50): newCx = -100 + 50 * 1.25 = -37.5, x = -87.5
    // Item B center (200): newCx = -100 + 200 * 1.25 = 150, x = 100
    // Item C center (350): newCx = -100 + 350 * 1.25 = 337.5, x = 287.5
    expect(updates.a).toBeDefined();
    expect(updates.b).toBeDefined();
    expect(updates.c).toBeDefined();
    expect(updates.a.x).toBeCloseTo(-87.5, 1);
    expect(updates.b.x).toBeCloseTo(100, 1);
    expect(updates.c.x).toBeCloseTo(287.5, 1);
  });
});
