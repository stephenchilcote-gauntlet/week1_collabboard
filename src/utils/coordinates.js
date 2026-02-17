const safeZoom = (zoom) => (zoom === 0 ? Number.EPSILON : zoom);

export const screenToBoard = (screenX, screenY, panX, panY, zoom) => {
  const adjustedZoom = safeZoom(zoom);
  return {
    x: screenX / adjustedZoom - panX,
    y: screenY / adjustedZoom - panY,
  };
};

export const boardToScreen = (boardX, boardY, panX, panY, zoom) => {
  const adjustedZoom = safeZoom(zoom);
  return {
    x: (boardX + panX) * adjustedZoom,
    y: (boardY + panY) * adjustedZoom,
  };
};

export const viewportCenter = (panX, panY, zoom, viewportWidth, viewportHeight) =>
  screenToBoard(viewportWidth / 2, viewportHeight / 2, panX, panY, zoom);

export const rectFromPoints = (start, end) => {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { x, y, width, height };
};

export const intersectsRect = (a, b) => (
  a.x <= b.x + b.width
  && a.x + a.width >= b.x
  && a.y <= b.y + b.height
  && a.y + a.height >= b.y
);

export const containsRect = (outer, inner) => (
  outer.x <= inner.x
  && outer.y <= inner.y
  && outer.x + outer.width >= inner.x + inner.width
  && outer.y + outer.height >= inner.y + inner.height
);

export const getObjectBounds = (obj) => {
  if (typeof obj.x1 === 'number' && typeof obj.y1 === 'number') {
    const x = Math.min(obj.x1, obj.x2);
    const y = Math.min(obj.y1, obj.y2);
    return { x, y, width: Math.abs(obj.x2 - obj.x1), height: Math.abs(obj.y2 - obj.y1) };
  }
  return {
    x: obj.x,
    y: obj.y,
    width: obj.width ?? 0,
    height: obj.height ?? 0,
  };
};
