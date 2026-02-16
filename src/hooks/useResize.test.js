import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { clampResize } from './useResize.js';

describe('useResize clamp', () => {
  test.prop([
    fc.integer({ min: -200, max: 200 }),
    fc.integer({ min: -200, max: 200 }),
    fc.constantFrom('nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'),
  ])('enforces minimum size', (dx, dy, handle) => {
    const result = clampResize({ x: 0, y: 0, width: 100, height: 80 }, handle, dx, dy);
    expect(result.width).toBeGreaterThanOrEqual(20);
    expect(result.height).toBeGreaterThanOrEqual(20);
  });
});
