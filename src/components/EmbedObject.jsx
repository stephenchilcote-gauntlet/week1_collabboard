import { useState } from 'react';

const CSP_META = '<meta http-equiv="Content-Security-Policy" content="default-src \'unsafe-inline\'; connect-src \'none\'; img-src data:;">';
const BASE_STYLE = '<style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;overflow:hidden}</style>';

const buildSrcdoc = (html) => `<!doctype html><html><head>${CSP_META}${BASE_STYLE}</head><body>${html}</body></html>`;

export default function EmbedObject({
  object,
  isSelected,
  isDragging,
  lockedByOther,
  onObjectPointerDown,
  zoom,
  remoteEntryPhase,
  interactionMode,
}) {
  const [isHovered, setIsHovered] = useState(false);

  const handlePointerDown = (event) => {
    if (lockedByOther) {
      return;
    }
    if (interactionMode === 'connecting') {
      return;
    }
    onObjectPointerDown?.(object, event);
  };

  const cursor = lockedByOther
    ? 'not-allowed'
    : interactionMode === 'connecting'
      ? 'crosshair'
      : isDragging ? 'grabbing' : 'grab';

  const isEntering = remoteEntryPhase === 'initial';
  const isHighlighted = remoteEntryPhase === 'active';

  return (
    <div
      data-testid="embed-object"
      data-object-id={object.id}
      onPointerDown={handlePointerDown}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        left: object.x,
        top: object.y,
        width: object.width ?? 400,
        height: object.height ?? 300,
        border: '2px solid rgba(0,0,0,0.1)',
        borderRadius: 6,
        overflow: 'hidden',
        zIndex: object.zIndex,
        cursor,
        userSelect: 'none',
        opacity: isEntering ? 0 : lockedByOther ? 0.5 : 1,
        filter: lockedByOther ? 'grayscale(60%)' : 'none',
        transition: 'opacity 300ms ease, box-shadow 300ms ease, filter 300ms ease',
        boxShadow: isHighlighted
          ? '0 0 0 4px rgba(59, 130, 246, 0.35)'
          : isHovered && !lockedByOther
            ? '0 0 0 2px rgba(59, 130, 246, 0.25)'
            : 'none',
        background: '#fff',
        transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
        transformOrigin: 'center',
      }}
    >
      <iframe
        sandbox="allow-scripts"
        srcDoc={buildSrcdoc(object.html ?? '')}
        title="Embed"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          pointerEvents: isDragging ? 'none' : 'auto',
        }}
      />
      {/* Overlay to capture pointer events for dragging when not interacting with content */}
      {!isSelected && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'transparent',
          }}
        />
      )}
    </div>
  );
}

export { buildSrcdoc };
