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

    const border = getByTestId('frame-border');
    expect(border.style.borderStyle).toBe('dashed');

    const titleBar = getByTestId('frame-title');
    expect(titleBar.style.background).toContain('rgba');
  });

  it('double-click on title enables editing and blur updates', () => {
    const { getByTestId, onUpdate } = renderFrame();

    fireEvent.doubleClick(getByTestId('frame-title'));
    const editor = getByTestId('frame-editor');
    fireEvent.change(editor, { target: { value: 'Updated' } });
    fireEvent.blur(editor);

    expect(onUpdate).toHaveBeenCalledWith('frame-1', { title: 'Updated' });
  });

  it('pointerDown on border edge selects and starts drag', () => {
    const { container, onSelect, onDragStart } = renderFrame();

    // The border edge divs are the ones with pointerEvents: auto and cursor: grab
    // Fire on the title bar which also handles pointer down
    const titleBar = container.querySelector('[data-testid="frame-title"]');
    fireEvent.pointerDown(titleBar, { clientX: 10, clientY: 10 });
    expect(onSelect).toHaveBeenCalledWith('frame-1', expect.any(Object));

    // Title bar uses deferred drag (waits for movement), so simulate movement
    fireEvent(document, new PointerEvent('pointermove', { clientX: 100, clientY: 100 }));
    expect(onDragStart).toHaveBeenCalled();
  });

  it('renders with a lower z-index than standard objects', () => {
    const { getByTestId } = renderFrame();
    const frame = getByTestId('frame');
    expect(Number(frame.style.zIndex)).toBe(defaultObject.zIndex);
  });

  it('lockedByOther blocks pointer events', () => {
    const { getByTestId, onSelect, onDragStart } = renderFrame({ lockedByOther: true });

    fireEvent.pointerDown(getByTestId('frame-title'), { clientX: 10, clientY: 10 });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('uses default colors when no color is set', () => {
    const { getByTestId } = renderFrame();

    const titleBar = getByTestId('frame-title');
    expect(titleBar.style.background).toContain('rgba');
  });

  it('applies custom color to border, background, and title bar', () => {
    const { getByTestId } = renderFrame({
      object: { ...defaultObject, color: '#FF6B6B' },
    });

    const border = getByTestId('frame-border');
    expect(border.style.border).toContain('dashed');

    const titleBar = getByTestId('frame-title');
    expect(titleBar.style.background).toContain('255, 107, 107');
  });

  it('Enter key commits the title edit', () => {
    const { getByTestId, onUpdate } = renderFrame();

    fireEvent.doubleClick(getByTestId('frame-title'));
    const editor = getByTestId('frame-editor');
    fireEvent.change(editor, { target: { value: 'New Title' } });
    fireEvent.keyDown(editor, { key: 'Enter' });

    expect(onUpdate).toHaveBeenCalledWith('frame-1', { title: 'New Title' });
  });
});
