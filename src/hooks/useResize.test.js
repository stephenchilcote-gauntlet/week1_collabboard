import { describe, expect, it } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { clampResize } from './useResize.js';

const square = { x: 100, y: 100, width: 100, height: 100 };
const rect = { x: 0, y: 0, width: 200, height: 100 };

describe('clampResize minimum size', () => {
  test.prop([
    fc.integer({ min: -200, max: 200 }),
    fc.integer({ min: -200, max: 200 }),
    fc.constantFrom('nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'),
  ])('enforces minimum size', (dx, dy, handle) => {
    const result = clampResize({ x: 0, y: 0, width: 100, height: 80 }, handle, dx, dy);
    expect(result.width).toBeGreaterThanOrEqual(20);
    expect(result.height).toBeGreaterThanOrEqual(20);
  });

  test.prop([
    fc.integer({ min: -200, max: 200 }),
    fc.integer({ min: -200, max: 200 }),
    fc.constantFrom('nw', 'ne', 'sw', 'se'),
  ])('enforces minimum size with keepAspect', (dx, dy, handle) => {
    const result = clampResize(square, handle, dx, dy, { keepAspect: true });
    expect(result.width).toBeGreaterThanOrEqual(20);
    expect(result.height).toBeGreaterThanOrEqual(20);
  });

  test.prop([
    fc.integer({ min: -200, max: 200 }),
    fc.integer({ min: -200, max: 200 }),
    fc.constantFrom('n', 'e', 's', 'w'),
  ])('enforces minimum size with symmetric', (dx, dy, handle) => {
    const result = clampResize(square, handle, dx, dy, { symmetric: true });
    expect(result.width).toBeGreaterThanOrEqual(20);
    expect(result.height).toBeGreaterThanOrEqual(20);
  });
});

describe('clampResize free resize (no options)', () => {
  it('east handle increases width, preserves height and y', () => {
    const result = clampResize(rect, 'e', 50, 10);
    expect(result).toEqual({ x: 0, y: 0, width: 250, height: 100 });
  });

  it('west handle moves left edge, preserves height and bottom', () => {
    const result = clampResize(rect, 'w', -30, 5);
    expect(result).toEqual({ x: -30, y: 0, width: 230, height: 100 });
  });

  it('north handle moves top edge, preserves width and x', () => {
    const result = clampResize(rect, 'n', 5, -40);
    expect(result).toEqual({ x: 0, y: -40, width: 200, height: 140 });
  });

  it('south handle increases height, preserves width and x', () => {
    const result = clampResize(rect, 's', 5, 30);
    expect(result).toEqual({ x: 0, y: 0, width: 200, height: 130 });
  });

  it('se corner moves right and bottom edges', () => {
    const result = clampResize(rect, 'se', 20, 30);
    expect(result).toEqual({ x: 0, y: 0, width: 220, height: 130 });
  });

  it('nw corner moves left and top edges', () => {
    const result = clampResize(rect, 'nw', -10, -20);
    expect(result).toEqual({ x: -10, y: -20, width: 210, height: 120 });
  });
});

describe('clampResize keepAspect (corner handles only)', () => {
  it('se corner preserves aspect ratio, driven by dx', () => {
    const result = clampResize(square, 'se', 60, 10, { keepAspect: true });
    // dx=60 dominates over dy=10, so width drives
    expect(result.width).toBe(160);
    expect(result.height).toBe(160);
    // top-left corner stays anchored
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });

  it('se corner preserves aspect ratio, driven by dy', () => {
    const result = clampResize(square, 'se', 10, 60, { keepAspect: true });
    // dy=60 dominates, so height drives
    expect(result.width).toBe(160);
    expect(result.height).toBe(160);
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });

  it('nw corner anchors bottom-right', () => {
    const result = clampResize(square, 'nw', -40, -50, { keepAspect: true });
    // dy dominates; height drives. Bottom-right stays at (200, 200)
    expect(result.width).toBe(result.height);
    expect(result.x + result.width).toBe(200);
    expect(result.y + result.height).toBe(200);
  });

  it('ne corner anchors bottom-left', () => {
    const result = clampResize(square, 'ne', 40, -50, { keepAspect: true });
    expect(result.width).toBe(result.height);
    // bottom-left stays anchored
    expect(result.x).toBe(100);
    expect(result.y + result.height).toBe(200);
  });

  it('sw corner anchors top-right', () => {
    const result = clampResize(square, 'sw', -40, 50, { keepAspect: true });
    expect(result.width).toBe(result.height);
    // top-right stays anchored
    expect(result.x + result.width).toBe(200);
    expect(result.y).toBe(100);
  });

  it('does not apply to edge handles even when keepAspect is true', () => {
    const result = clampResize(square, 'e', 50, 10, { keepAspect: true });
    // width changes but height stays the same
    expect(result.width).toBe(150);
    expect(result.height).toBe(100);
  });

  test.prop([
    fc.integer({ min: -80, max: 200 }),
    fc.integer({ min: -80, max: 200 }),
    fc.constantFrom('nw', 'ne', 'sw', 'se'),
  ])('always preserves aspect ratio for corner handles', (dx, dy, handle) => {
    const result = clampResize(square, handle, dx, dy, { keepAspect: true });
    expect(result.width).toBeCloseTo(result.height, 5);
  });

  it('preserves non-square aspect ratio on corners', () => {
    const ellipse = { x: 0, y: 0, width: 200, height: 100 };
    const result = clampResize(ellipse, 'se', 40, 5, { keepAspect: true });
    expect(result.width / result.height).toBeCloseTo(2, 5);
  });
});

describe('clampResize symmetric (circle edge handles)', () => {
  it('east handle grows symmetrically, center stays fixed', () => {
    const result = clampResize(square, 'e', 30, 15, { symmetric: true });
    const origCenter = square.x + square.width / 2;
    const newCenter = result.x + result.width / 2;
    expect(newCenter).toBe(origCenter);
    // height unchanged
    expect(result.height).toBe(100);
    // width grew by 2*dx (both edges moved)
    expect(result.width).toBe(160);
  });

  it('west handle grows symmetrically, center stays fixed', () => {
    const result = clampResize(square, 'w', -30, 15, { symmetric: true });
    const origCenter = square.x + square.width / 2;
    const newCenter = result.x + result.width / 2;
    expect(newCenter).toBe(origCenter);
    expect(result.height).toBe(100);
    expect(result.width).toBe(160);
  });

  it('north handle grows symmetrically, center stays fixed', () => {
    const result = clampResize(square, 'n', 15, -30, { symmetric: true });
    const origCenterY = square.y + square.height / 2;
    const newCenterY = result.y + result.height / 2;
    expect(newCenterY).toBe(origCenterY);
    // width unchanged
    expect(result.width).toBe(100);
    expect(result.height).toBe(160);
  });

  it('south handle grows symmetrically, center stays fixed', () => {
    const result = clampResize(square, 's', 15, 30, { symmetric: true });
    const origCenterY = square.y + square.height / 2;
    const newCenterY = result.y + result.height / 2;
    expect(newCenterY).toBe(origCenterY);
    expect(result.width).toBe(100);
    expect(result.height).toBe(160);
  });

  it('does not apply symmetric to corner handles', () => {
    const result = clampResize(square, 'se', 30, 30, { symmetric: true });
    // corner handle: only right and bottom move, left and top stay anchored
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
    expect(result.width).toBe(130);
    expect(result.height).toBe(130);
  });

  test.prop([
    fc.integer({ min: -40, max: 200 }),
    fc.integer({ min: -200, max: 200 }),
  ])('east handle always preserves horizontal center', (dx, dy) => {
    const result = clampResize(square, 'e', dx, dy, { symmetric: true });
    const origCenter = square.x + square.width / 2;
    const newCenter = result.x + result.width / 2;
    expect(newCenter).toBe(origCenter);
    expect(result.height).toBe(square.height);
  });

  test.prop([
    fc.integer({ min: -200, max: 200 }),
    fc.integer({ min: -40, max: 200 }),
  ])('south handle always preserves vertical center', (dx, dy) => {
    const result = clampResize(square, 's', dx, dy, { symmetric: true });
    const origCenter = square.y + square.height / 2;
    const newCenter = result.y + result.height / 2;
    expect(newCenter).toBe(origCenter);
    expect(result.width).toBe(square.width);
  });
});
