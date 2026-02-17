import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { boardToScreen, screenToBoard, viewportCenter, containsRect, getObjectBounds } from './coordinates.js';

const zoomArb = fc.float({ min: Math.fround(0.1), max: Math.fround(3.0), noNaN: true });
const coordArb = fc.float({ min: Math.fround(-5000), max: Math.fround(5000), noNaN: true });
const screenArb = fc.float({ min: Math.fround(-5000), max: Math.fround(5000), noNaN: true });
const sizeArb = fc.integer({ min: 100, max: 3000 });
const heightArb = fc.integer({ min: 100, max: 2000 });

describe('coordinates', () => {
  test.prop([
    coordArb,
    coordArb,
    coordArb,
    coordArb,
    zoomArb,
  ])('screenToBoard reverses boardToScreen within epsilon', (boardX, boardY, panX, panY, zoom) => {
    const screenPoint = boardToScreen(boardX, boardY, panX, panY, zoom);
    const roundTrip = screenToBoard(screenPoint.x, screenPoint.y, panX, panY, zoom);
    expect(roundTrip.x).toBeCloseTo(boardX, 3);
    expect(roundTrip.y).toBeCloseTo(boardY, 3);
  });

  test.prop([
    screenArb,
    screenArb,
    coordArb,
    coordArb,
    zoomArb,
  ])('boardToScreen reverses screenToBoard within epsilon', (screenX, screenY, panX, panY, zoom) => {
    const boardPoint = screenToBoard(screenX, screenY, panX, panY, zoom);
    const roundTrip = boardToScreen(boardPoint.x, boardPoint.y, panX, panY, zoom);
    expect(roundTrip.x).toBeCloseTo(screenX, 3);
    expect(roundTrip.y).toBeCloseTo(screenY, 3);
  });

  test.prop([
    coordArb,
    coordArb,
    zoomArb,
    sizeArb,
    heightArb,
  ])('viewportCenter maps back to the viewport midpoint', (panX, panY, zoom, width, height) => {
    const center = viewportCenter(panX, panY, zoom, width, height);
    const screenPoint = boardToScreen(center.x, center.y, panX, panY, zoom);
    expect(screenPoint.x).toBeCloseTo(width / 2, 3);
    expect(screenPoint.y).toBeCloseTo(height / 2, 3);
  });
});

const rectArb = fc.record({
  x: coordArb,
  y: coordArb,
  width: fc.float({ min: Math.fround(0), max: Math.fround(5000), noNaN: true }),
  height: fc.float({ min: Math.fround(0), max: Math.fround(5000), noNaN: true }),
});

describe('containsRect', () => {
  test('returns true when inner is fully inside outer', () => {
    const outer = { x: 0, y: 0, width: 100, height: 100 };
    const inner = { x: 10, y: 10, width: 30, height: 30 };
    expect(containsRect(outer, inner)).toBe(true);
  });

  test('returns false when inner extends beyond outer on any edge', () => {
    const outer = { x: 10, y: 10, width: 50, height: 50 };
    expect(containsRect(outer, { x: 5, y: 20, width: 20, height: 20 })).toBe(false);  // left
    expect(containsRect(outer, { x: 20, y: 5, width: 20, height: 20 })).toBe(false);  // top
    expect(containsRect(outer, { x: 40, y: 20, width: 30, height: 20 })).toBe(false); // right
    expect(containsRect(outer, { x: 20, y: 40, width: 20, height: 30 })).toBe(false); // bottom
  });

  test('returns true when inner equals outer (exact boundary)', () => {
    const rect = { x: 5, y: 5, width: 50, height: 50 };
    expect(containsRect(rect, rect)).toBe(true);
  });

  test.prop([rectArb])('self-containment: containsRect(rect, rect) === true', (rect) => {
    expect(containsRect(rect, rect)).toBe(true);
  });

  test.prop([
    rectArb,
    fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
    fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
    fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
    fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
  ])('inner constructed inside outer is always contained', (outer, fx, fy, fw, fh) => {
    const inner = {
      x: outer.x + fx * outer.width,
      y: outer.y + fy * outer.height,
      width: (1 - fx) * outer.width * fw,
      height: (1 - fy) * outer.height * fh,
    };
    expect(containsRect(outer, inner)).toBe(true);
  });
});

describe('getObjectBounds', () => {
  test('returns {x, y, width, height} for rect-like objects', () => {
    const obj = { x: 10, y: 20, width: 100, height: 200 };
    expect(getObjectBounds(obj)).toEqual({ x: 10, y: 20, width: 100, height: 200 });
  });

  test('returns normalized bounds for line-like objects', () => {
    expect(getObjectBounds({ x1: 50, y1: 50, x2: 10, y2: 10 }))
      .toEqual({ x: 10, y: 10, width: 40, height: 40 });
    expect(getObjectBounds({ x1: 10, y1: 10, x2: 50, y2: 50 }))
      .toEqual({ x: 10, y: 10, width: 40, height: 40 });
  });

  test('returns width/height of 0 when they are missing', () => {
    expect(getObjectBounds({ x: 5, y: 10 }))
      .toEqual({ x: 5, y: 10, width: 0, height: 0 });
  });
});
