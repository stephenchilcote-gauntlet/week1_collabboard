import { describe, expect, it } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { isClickThreshold } from './useDrag.js';

describe('useDrag threshold', () => {
  test.prop([
    fc.integer({ min: -4, max: 4 }),
    fc.integer({ min: -4, max: 4 }),
  ])('treats deltas under 5px as click', (dx, dy) => {
    if (Math.hypot(dx, dy) >= 5) {
      return;
    }
    expect(isClickThreshold(dx, dy)).toBe(true);
  });

  test.prop([
    fc.integer({ min: -20, max: 20 }),
    fc.integer({ min: -20, max: 20 }),
  ])('treats deltas of 5px or more as drag', (dx, dy) => {
    if (Math.hypot(dx, dy) < 5) {
      return;
    }
    expect(isClickThreshold(dx, dy)).toBe(false);
  });
});
