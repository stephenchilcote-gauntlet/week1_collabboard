import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRotation } from './useRotation.js';

describe('useRotation', () => {
  it('produces positive angle clockwise from 12 o-clock', () => {
    const { result } = renderHook(() => useRotation());

    act(() => {
      result.current.startRotation({ x: 0, y: 0 }, { x: 0, y: -10 });
    });

    act(() => {
      const angle = result.current.updateRotation({ x: 10, y: 0 });
      expect(angle).toBeGreaterThan(0);
    });
  });

  it('produces negative angle counter-clockwise', () => {
    const { result } = renderHook(() => useRotation());

    act(() => {
      result.current.startRotation({ x: 0, y: 0 }, { x: 0, y: -10 });
    });

    act(() => {
      const angle = result.current.updateRotation({ x: -10, y: 0 });
      expect(angle).toBeLessThan(0);
    });
  });

  it('normalizes angle to 0-360', () => {
    const { result } = renderHook(() => useRotation());

    act(() => {
      result.current.startRotation({ x: 0, y: 0 }, { x: 0, y: -10 });
    });

    act(() => {
      const angle = result.current.updateRotation({ x: 0, y: -10 });
      const normalized = result.current.normalizeAngle(angle + 450);
      expect(normalized).toBeGreaterThanOrEqual(0);
      expect(normalized).toBeLessThanOrEqual(360);
    });
  });
});
