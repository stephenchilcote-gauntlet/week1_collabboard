import { describe, expect, it } from 'vitest';
import { orbitAroundCenter, scaleDistancesFromCenter } from './multiTransformUtils.js';

describe('orbitAroundCenter', () => {
  const items = [
    { id: 'a', x: 0, y: 0, width: 100, height: 100 },
    { id: 'b', x: 200, y: 0, width: 100, height: 100 },
  ];
  // barycenter of centers: (100, 50) and (250, 50) → center = (175, 50)
  // but we pass an explicit center

  it('returns original positions at 0 degrees', () => {
    const center = { x: 100, y: 50 };
    const result = orbitAroundCenter(items, center, 0);
    expect(result).toEqual([
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 200, y: 0 },
    ]);
  });

  it('rotates items 90 degrees clockwise around center', () => {
    // Two items centered at (50,50) and (250,50), center = (150,50)
    const testItems = [
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      { id: 'b', x: 200, y: 0, width: 100, height: 100 },
    ];
    const center = { x: 150, y: 50 };
    // Item A center (50,50) relative to center: (-100, 0)
    // Rotated 90°: (0, -100) → new center (150, -50) → x=100, y=-100
    // Item B center (250,50) relative to center: (100, 0)
    // Rotated 90°: (0, 100) → new center (150, 150) → x=100, y=100
    const result = orbitAroundCenter(testItems, center, 90);
    expect(result[0].id).toBe('a');
    expect(result[0].x).toBeCloseTo(100, 5);
    expect(result[0].y).toBeCloseTo(-100, 5);
    expect(result[1].id).toBe('b');
    expect(result[1].x).toBeCloseTo(100, 5);
    expect(result[1].y).toBeCloseTo(100, 5);
  });

  it('rotates items 180 degrees swaps positions', () => {
    const testItems = [
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      { id: 'b', x: 200, y: 0, width: 100, height: 100 },
    ];
    const center = { x: 150, y: 50 };
    const result = orbitAroundCenter(testItems, center, 180);
    // Item A center (50,50) → rotated 180° → (250,50) → x=200, y=0
    // Item B center (250,50) → rotated 180° → (50,50) → x=0, y=0
    expect(result[0].x).toBeCloseTo(200, 5);
    expect(result[0].y).toBeCloseTo(0, 5);
    expect(result[1].x).toBeCloseTo(0, 5);
    expect(result[1].y).toBeCloseTo(0, 5);
  });

  it('rotates items 360 degrees returns to original', () => {
    const testItems = [
      { id: 'a', x: 10, y: 20, width: 60, height: 40 },
      { id: 'b', x: 200, y: 100, width: 80, height: 80 },
    ];
    const center = { x: 125, y: 80 };
    const result = orbitAroundCenter(testItems, center, 360);
    expect(result[0].x).toBeCloseTo(10, 5);
    expect(result[0].y).toBeCloseTo(20, 5);
    expect(result[1].x).toBeCloseTo(200, 5);
    expect(result[1].y).toBeCloseTo(100, 5);
  });

  it('preserves distances from center', () => {
    const testItems = [
      { id: 'a', x: 0, y: 0, width: 50, height: 50 },
      { id: 'b', x: 300, y: 0, width: 50, height: 50 },
    ];
    const center = { x: 175, y: 25 };
    const result = orbitAroundCenter(testItems, center, 45);

    // Check that distance from center is preserved for each item
    const origACx = 25, origACy = 25;
    const origBCx = 325, origBCy = 25;
    const distA = Math.hypot(origACx - center.x, origACy - center.y);
    const distB = Math.hypot(origBCx - center.x, origBCy - center.y);

    const newACx = result[0].x + 25, newACy = result[0].y + 25;
    const newBCx = result[1].x + 25, newBCy = result[1].y + 25;
    const newDistA = Math.hypot(newACx - center.x, newACy - center.y);
    const newDistB = Math.hypot(newBCx - center.x, newBCy - center.y);

    expect(newDistA).toBeCloseTo(distA, 5);
    expect(newDistB).toBeCloseTo(distB, 5);
  });

  it('handles items without width/height', () => {
    const testItems = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 100, y: 0 },
    ];
    const center = { x: 50, y: 0 };
    const result = orbitAroundCenter(testItems, center, 90);
    expect(result[0].x).toBeCloseTo(50, 5);
    expect(result[0].y).toBeCloseTo(-50, 5);
    expect(result[1].x).toBeCloseTo(50, 5);
    expect(result[1].y).toBeCloseTo(50, 5);
  });
});

describe('scaleDistancesFromCenter', () => {
  it('returns original positions at scale factor 1', () => {
    const items = [
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      { id: 'b', x: 200, y: 0, width: 100, height: 100 },
    ];
    const bounds = { x: 0, y: 0, width: 300, height: 100 };
    const nextBounds = { x: 0, y: 0, width: 300, height: 100 };
    const result = scaleDistancesFromCenter(items, bounds, nextBounds);
    expect(result[0]).toEqual({ id: 'a', x: 0, y: 0 });
    expect(result[1]).toEqual({ id: 'b', x: 200, y: 0 });
  });

  it('scales items apart when bounds grow via east handle', () => {
    // Two items side by side
    const items = [
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      { id: 'b', x: 200, y: 0, width: 100, height: 100 },
    ];
    const bounds = { x: 0, y: 0, width: 300, height: 100 };
    // East handle: left stays at 0, right moves from 300→400
    const nextBounds = { x: 0, y: 0, width: 400, height: 100 };
    const result = scaleDistancesFromCenter(items, bounds, nextBounds);

    // Affine mapping: newX = next.x + (itemCenterX - bounds.x) * (next.width / bounds.width) - halfW
    // Item A center = (50, 50), scaleX = 400/300 = 4/3
    // newCx = 0 + 50 * 4/3 = 66.67, newX = 66.67 - 50 = 16.67
    // Item B center = (250, 50)
    // newCx = 0 + 250 * 4/3 = 333.33, newX = 333.33 - 50 = 283.33
    expect(result[0].x).toBeCloseTo(16.667, 1);
    expect(result[1].x).toBeCloseTo(283.333, 1);
    // Y should not change (scaleY = 1)
    expect(result[0].y).toBeCloseTo(0, 5);
    expect(result[1].y).toBeCloseTo(0, 5);
  });

  it('scales items closer when bounds shrink', () => {
    const items = [
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      { id: 'b', x: 200, y: 0, width: 100, height: 100 },
    ];
    const bounds = { x: 0, y: 0, width: 300, height: 100 };
    const nextBounds = { x: 0, y: 0, width: 150, height: 100 };
    const result = scaleDistancesFromCenter(items, bounds, nextBounds);

    // scaleX = 150/300 = 0.5
    // Item A center (50) → 25 → x = -25
    // Item B center (250) → 125 → x = 75
    expect(result[0].x).toBeCloseTo(-25, 5);
    expect(result[1].x).toBeCloseTo(75, 5);
    // Distance between centers should be halved
    const origDist = 200; // 250 - 50
    const newDist = (result[1].x + 50) - (result[0].x + 50);
    expect(newDist).toBeCloseTo(origDist * 0.5, 5);
  });

  it('handles west handle (bounds.x shifts)', () => {
    const items = [
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      { id: 'b', x: 200, y: 0, width: 100, height: 100 },
    ];
    const bounds = { x: 0, y: 0, width: 300, height: 100 };
    // West handle moved left by 100: x goes from 0 to -100, width 300→400
    const nextBounds = { x: -100, y: 0, width: 400, height: 100 };
    const result = scaleDistancesFromCenter(items, bounds, nextBounds);

    // scaleX = 400/300 = 4/3
    // Item A center (50): newCx = -100 + 50 * 4/3 = -33.33, x = -83.33
    // Item B center (250): newCx = -100 + 250 * 4/3 = 233.33, x = 183.33
    expect(result[0].x).toBeCloseTo(-83.333, 1);
    expect(result[1].x).toBeCloseTo(183.333, 1);
  });

  it('handles both axes scaling (corner handle)', () => {
    const items = [
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
      { id: 'b', x: 200, y: 200, width: 100, height: 100 },
    ];
    const bounds = { x: 0, y: 0, width: 300, height: 300 };
    const nextBounds = { x: 0, y: 0, width: 600, height: 600 };
    const result = scaleDistancesFromCenter(items, bounds, nextBounds);

    // scaleX = scaleY = 2
    // Item A center (50,50): new (100,100), x=50, y=50
    // Item B center (250,250): new (500,500), x=450, y=450
    expect(result[0].x).toBeCloseTo(50, 5);
    expect(result[0].y).toBeCloseTo(50, 5);
    expect(result[1].x).toBeCloseTo(450, 5);
    expect(result[1].y).toBeCloseTo(450, 5);
  });

  it('handles zero-width bounds gracefully', () => {
    const items = [
      { id: 'a', x: 100, y: 0, width: 0, height: 100 },
      { id: 'b', x: 100, y: 200, width: 0, height: 100 },
    ];
    const bounds = { x: 100, y: 0, width: 0, height: 300 };
    const nextBounds = { x: 100, y: 0, width: 0, height: 600 };
    const result = scaleDistancesFromCenter(items, bounds, nextBounds);
    // X should stay unchanged (scaleX=1 fallback), Y should scale
    // Item A center (100,50), scaleY=2: newCy = 0 + 50*2 = 100, y = 100-50 = 50
    // Item B center (100,250), scaleY=2: newCy = 0 + 250*2 = 500, y = 500-50 = 450
    expect(result[0].x).toBe(100);
    expect(result[1].x).toBe(100);
    expect(result[0].y).toBeCloseTo(50, 5);
    expect(result[1].y).toBeCloseTo(450, 5);
  });

  it('does not change item sizes', () => {
    const items = [
      { id: 'a', x: 0, y: 0, width: 80, height: 60 },
      { id: 'b', x: 200, y: 100, width: 120, height: 90 },
    ];
    const bounds = { x: 0, y: 0, width: 320, height: 190 };
    const nextBounds = { x: 0, y: 0, width: 640, height: 380 };
    const result = scaleDistancesFromCenter(items, bounds, nextBounds);
    // Results should only contain id, x, y — no width/height changes
    expect(result[0]).toEqual(expect.objectContaining({ id: 'a' }));
    expect(result[0]).not.toHaveProperty('width');
    expect(result[0]).not.toHaveProperty('height');
    expect(result[1]).not.toHaveProperty('width');
    expect(result[1]).not.toHaveProperty('height');
  });
});
