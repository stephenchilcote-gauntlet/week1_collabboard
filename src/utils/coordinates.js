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
