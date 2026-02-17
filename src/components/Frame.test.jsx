import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Frame from './Frame.jsx';

const defaultObject = {
  id: 'frame-1',
  x: 10,
  y: 20,
  width: 300,
  height: 200,
  title: 'Project',
  zIndex: 1,
};

const renderFrame = (props = {}) => {
  const defaults = {
    object: defaultObject,
    isSelected: false,
    isDragging: false,
    lockedByOther: false,
    onSelect: vi.fn(),
    onUpdate: vi.fn(),
    onDragStart: vi.fn(),
    onResizeStart: vi.fn(),
    zoom: 1,
    interactionMode: 'idle',
  };
  const merged = { ...defaults, ...props };
  return { ...render(<Frame {...merged} />), ...merged };
};

describe('Frame', () => {
  it('renders with title, dashed border, and translucent fill', () => {
    const { getByTestId } = renderFrame();

    const frame = getByTestId('frame');
    expect(frame.getAttribute('data-object-id')).toBe('frame-1');
    expect(frame.textContent).toContain('Project');
    expect(frame.style.borderStyle).toBe('dashed');
    expect(frame.style.background).toContain('rgba');
  });

  it('double-click on title enables editing and blur updates', () => {
    const { getByTestId, onUpdate } = renderFrame();

    fireEvent.doubleClick(getByTestId('frame-title'));
    const editor = getByTestId('frame-editor');
    fireEvent.change(editor, { target: { value: 'Updated' } });
    fireEvent.blur(editor);

    expect(onUpdate).toHaveBeenCalledWith('frame-1', { title: 'Updated' });
  });

  it('pointerDown selects and starts drag', () => {
    const { getByTestId, onSelect, onDragStart } = renderFrame();

    fireEvent.pointerDown(getByTestId('frame'), { clientX: 10, clientY: 10 });
    expect(onSelect).toHaveBeenCalledWith('frame-1', expect.any(Object));
    expect(onDragStart).toHaveBeenCalled();
  });

  it('renders with a lower z-index than standard objects', () => {
    const { getByTestId } = renderFrame();
    const frame = getByTestId('frame');
    expect(Number(frame.style.zIndex)).toBe(defaultObject.zIndex);
  });

  it('lockedByOther blocks pointer events', () => {
    const { getByTestId, onSelect, onDragStart } = renderFrame({ lockedByOther: true });

    fireEvent.pointerDown(getByTestId('frame'), { clientX: 10, clientY: 10 });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onDragStart).not.toHaveBeenCalled();
  });
});
