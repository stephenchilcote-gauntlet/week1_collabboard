import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TextElement from './TextElement.jsx';

const defaultObject = {
  id: 'text-1',
  x: 10,
  y: 20,
  width: 160,
  height: 40,
  text: 'Hello',
  fontSize: 16,
  zIndex: 2,
  color: '#111827',
};

const renderText = (props = {}) => {
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
  return { ...render(<TextElement {...merged} />), ...merged };
};

describe('TextElement', () => {
  it('renders with transparent background and text content', () => {
    const { getByTestId } = renderText();

    const element = getByTestId('text-element');
    expect(element.getAttribute('data-object-id')).toBe('text-1');
    expect(element.style.background).toBe('transparent');
    expect(element.textContent).toContain('Hello');
  });

  it('double-click enables inline editing', () => {
    const { getByTestId } = renderText();

    fireEvent.doubleClick(getByTestId('text-element'));
    expect(getByTestId('text-editor')).toBeInTheDocument();
  });

  it('onBlur calls onUpdate with new text', () => {
    const { getByTestId, onUpdate } = renderText();

    fireEvent.doubleClick(getByTestId('text-element'));
    const editor = getByTestId('text-editor');
    fireEvent.change(editor, { target: { value: 'Updated' } });
    fireEvent.blur(editor);

    expect(onUpdate).toHaveBeenCalledWith('text-1', { text: 'Updated' });
  });

  it('pointerDown selects and starts drag', () => {
    const { getByTestId, onSelect, onDragStart } = renderText();

    fireEvent.pointerDown(getByTestId('text-element'), { clientX: 10, clientY: 10 });
    expect(onSelect).toHaveBeenCalledWith('text-1', expect.any(Object));
    expect(onDragStart).toHaveBeenCalled();
  });

  it('lockedByOther blocks pointer events', () => {
    const { getByTestId, onSelect, onDragStart } = renderText({ lockedByOther: true });

    fireEvent.pointerDown(getByTestId('text-element'), { clientX: 10, clientY: 10 });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onDragStart).not.toHaveBeenCalled();
  });
});
