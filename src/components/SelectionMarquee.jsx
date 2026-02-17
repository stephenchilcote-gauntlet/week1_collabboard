export default function SelectionMarquee({ bounds, zoom }) {
  if (!bounds) {
    return null;
  }

  return (
    <div
      data-testid="selection-marquee"
      style={{
        position: 'absolute',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        border: `${1 / (zoom || 1)}px dashed rgba(59, 130, 246, 0.8)`,
        background: 'rgba(59, 130, 246, 0.12)',
        pointerEvents: 'none',
        zIndex: 200,
      }}
    />
  );
}
