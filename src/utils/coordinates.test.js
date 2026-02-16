import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { boardToScreen, screenToBoard, viewportCenter } from './coordinates.js';

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
