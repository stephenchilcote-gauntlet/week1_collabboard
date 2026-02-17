import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const useViewport = (boardRef) => {
  const [camera, setCamera] = useState({ panX: 0, panY: 0, zoom: 1 });
  const [viewportSize, setViewportSize] = useState({ viewportWidth: 0, viewportHeight: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panAnchor = useRef({ x: 0, y: 0 });
  const pointerIdRef = useRef(null);

  const handlePanStart = useCallback((containerX, containerY, pointerId) => {
    setIsPanning(true);
    panAnchor.current = { x: containerX, y: containerY };
    pointerIdRef.current = pointerId ?? null;
    if (boardRef?.current && pointerId !== undefined) {
      boardRef.current.setPointerCapture?.(pointerId);
    }
  }, [boardRef]);

  const handlePanMove = useCallback((containerX, containerY) => {
    if (!isPanning) {
      return;
    }

    const dx = containerX - panAnchor.current.x;
    const dy = containerY - panAnchor.current.y;
    setCamera((prev) => ({
      ...prev,
      panX: prev.panX + dx / prev.zoom,
      panY: prev.panY + dy / prev.zoom,
    }));
    panAnchor.current = { x: containerX, y: containerY };
  }, [isPanning]);

  const handlePanEnd = useCallback((pointerId) => {
    setIsPanning(false);
    if (boardRef?.current && pointerId !== undefined) {
      boardRef.current.releasePointerCapture?.(pointerId);
    } else if (boardRef?.current && pointerIdRef.current !== null) {
      boardRef.current.releasePointerCapture?.(pointerIdRef.current);
    }
    pointerIdRef.current = null;
  }, [boardRef]);

  const handleZoom = useCallback((deltaY, containerX, containerY) => {
    setCamera((prev) => {
      const nextZoom = clamp(prev.zoom * (deltaY > 0 ? 0.95 : 1.05), 0.1, 3.0);
      const boardX = containerX / prev.zoom - prev.panX;
      const boardY = containerY / prev.zoom - prev.panY;
      return {
        zoom: nextZoom,
        panX: containerX / nextZoom - boardX,
        panY: containerY / nextZoom - boardY,
      };
    });
  }, []);

  useEffect(() => {
    const updateSize = () => {
      if (!boardRef?.current) {
        return;
      }
      setViewportSize({
        viewportWidth: boardRef.current.clientWidth,
        viewportHeight: boardRef.current.clientHeight,
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [boardRef]);

  const resetZoom = useCallback(() => {
    setCamera({ panX: 0, panY: 0, zoom: 1 });
  }, []);

  const zoomPercent = useMemo(() => Math.round(camera.zoom * 100), [camera.zoom]);

  return {
    panX: camera.panX,
    panY: camera.panY,
    zoom: camera.zoom,
    zoomPercent,
    viewportWidth: viewportSize.viewportWidth,
    viewportHeight: viewportSize.viewportHeight,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    handleZoom,
    resetZoom,
    isPanning,
  };
};
