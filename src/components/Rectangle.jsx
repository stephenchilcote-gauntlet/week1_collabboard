export default function Rectangle({
  object,
  isSelected,
  onSelect,
  onUpdate,
  onDragStart,
  onResizeStart,
  zoom,
  remoteEntryPhase,
}) {
  const handlePointerDown = (event) => {
    onSelect(object.id);
    onDragStart(object, event);
  };

  const isEntering = remoteEntryPhase === 'initial';
  const isHighlighted = remoteEntryPhase === 'active';

  return (
    <div
      data-testid="rectangle"
      data-object-id={object.id}
      onPointerDown={handlePointerDown}
      style={{
        position: 'absolute',
        left: object.x,
        top: object.y,
        width: object.width,
        height: object.height,
        background: object.color,
        border: '2px solid rgba(0,0,0,0.2)',
        boxSizing: 'border-box',
        zIndex: object.zIndex,
        cursor: isSelected ? 'grabbing' : 'grab',
        opacity: isEntering ? 0 : 1,
        transition: 'opacity 300ms ease, box-shadow 300ms ease',
        boxShadow: isHighlighted ? '0 0 0 3px rgba(59, 130, 246, 0.35)' : 'none',
      }}
    />
  );
}
