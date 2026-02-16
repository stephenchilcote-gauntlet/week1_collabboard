export const screenToBoard = (screenX, screenY, panX, panY, zoom) => ({
  x: screenX / zoom - panX,
  y: screenY / zoom - panY,
});

export const boardToScreen = (boardX, boardY, panX, panY, zoom) => ({
  x: (boardX + panX) * zoom,
  y: (boardY + panY) * zoom,
});

export const viewportCenter = (panX, panY, zoom, viewportWidth, viewportHeight) =>
  screenToBoard(viewportWidth / 2, viewportHeight / 2, panX, panY, zoom);
