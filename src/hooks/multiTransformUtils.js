/**
 * Orbit items around a center point by the given angle (degrees).
 * Returns new { id, x, y } for each item — positions only, no size changes.
 */
export const orbitAroundCenter = (items, center, angleDeg) => {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return items.map((item) => {
    const halfW = (item.width ?? 0) / 2;
    const halfH = (item.height ?? 0) / 2;
    const cx = item.x + halfW;
    const cy = item.y + halfH;
    const dx = cx - center.x;
    const dy = cy - center.y;
    const nx = center.x + dx * cos - dy * sin;
    const ny = center.y + dx * sin + dy * cos;
    return { id: item.id, x: nx - halfW, y: ny - halfH };
  });
};

/**
 * Scale item distances using affine mapping from old bounds to new bounds.
 * Returns new { id, x, y } for each item — positions only, no size changes.
 */
export const scaleDistancesFromCenter = (items, bounds, nextBounds) => {
  const scaleX = bounds.width > 0 ? nextBounds.width / bounds.width : 1;
  const scaleY = bounds.height > 0 ? nextBounds.height / bounds.height : 1;
  return items.map((item) => {
    const halfW = (item.width ?? 0) / 2;
    const halfH = (item.height ?? 0) / 2;
    const cx = item.x + halfW;
    const cy = item.y + halfH;
    const newCx = nextBounds.x + (cx - bounds.x) * scaleX;
    const newCy = nextBounds.y + (cy - bounds.y) * scaleY;
    return { id: item.id, x: newCx - halfW, y: newCy - halfH };
  });
};
