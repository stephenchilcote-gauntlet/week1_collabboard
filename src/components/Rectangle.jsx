export default function Rectangle({
  object,
  isSelected,
  onSelect,
  onUpdate,
  onDragStart,
  onResizeStart,
  zoom,
}) {
  const handlePointerDown = (event) => {
    onSelect(object.id);
    onDragStart(object.id, event.clientX, event.clientY);
  };

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
      }}
    />
  );
}
