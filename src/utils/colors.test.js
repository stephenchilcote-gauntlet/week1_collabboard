import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import {
  OBJECT_COLORS,
  SELECTION_COLOR,
  ERROR_COLOR,
  ERROR_BG,
  ERROR_TEXT,
  WARNING_COLOR,
  DEFAULT_RECTANGLE_COLOR,
  DEFAULT_STICKY_COLOR,
  cursorColorFromUid,
} from './colors.js';

const hueFromHsl = (hsl) => {
  const match = /hsl\((\d+(?:\.\d+)?),/.exec(hsl);
  return match ? Number(match[1]) : NaN;
};

describe('colors', () => {
  test.prop([fc.constantFrom(...OBJECT_COLORS)])(
    'object colors exclude selection and error colors',
    (color) => {
      expect(color).not.toBe(SELECTION_COLOR);
      expect(color).not.toBe(ERROR_COLOR);
      expect(color).not.toBe(WARNING_COLOR);
    },
  );

  it('defines a palette with at least six colors', () => {
    expect(OBJECT_COLORS.length).toBeGreaterThanOrEqual(6);
  });

  it('uses distinct defaults for sticky notes and rectangles', () => {
    expect(DEFAULT_STICKY_COLOR).not.toBe(DEFAULT_RECTANGLE_COLOR);
  });

  it('error palette colors are distinct from each other', () => {
    const errorColors = [ERROR_COLOR, ERROR_BG, ERROR_TEXT];
    const unique = new Set(errorColors);
    expect(unique.size).toBe(3);
  });

  test.prop([fc.string()])('cursor color is deterministic and avoids reserved hues', (uid) => {
    const color = cursorColorFromUid(uid);
    const hue = hueFromHsl(color);

    expect(cursorColorFromUid(uid)).toBe(color);
    expect(hue).not.toBeNaN();
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
    expect(hue < 15 || hue > 345).toBe(false);
    expect(hue >= 195 && hue <= 225).toBe(false);
  });
});
