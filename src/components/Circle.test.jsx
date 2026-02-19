import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Circle from './Circle.jsx';

const defaultObject = { id: 'circle-1', x: 10, y: 20, width: 120, height: 120, color: '#FF6B6B', zIndex: 2 };

const renderCircle = (props = {}) => {
  const defaults = {
    object: defaultObject,
    isDragging: false,
    lockedByOther: false,
    onObjectPointerDown: vi.fn(),
    onUpdate: vi.fn(),
    onResizeStart: vi.fn(),
    zoom: 1,
    interactionMode: 'idle',
  };
  const merged = { ...defaults, ...props };
  return { ...render(<Circle {...merged} />), ...merged };
};

describe('Circle', () => {
  it('renders with data-object-id, color, and border radius', () => {
    const { getByTestId } = renderCircle();

    const circle = getByTestId('circle');
    expect(circle.getAttribute('data-object-id')).toBe('circle-1');
    expect(circle.style.background).toBe('rgb(255, 107, 107)');
    expect(circle.style.borderRadius).toBe('50%');
  });

  it('pointerDown triggers onObjectPointerDown', () => {
    const { getByTestId, onObjectPointerDown } = renderCircle();

    fireEvent.pointerDown(getByTestId('circle'), { clientX: 10, clientY: 20 });

    expect(onObjectPointerDown).toHaveBeenCalledWith(defaultObject, expect.any(Object));
  });

  it('lockedByOther blocks pointer events and shows locked styles', () => {
    const { getByTestId, onObjectPointerDown } = renderCircle({ lockedByOther: true });

    const circle = getByTestId('circle');
    fireEvent.pointerDown(circle, { clientX: 10, clientY: 20 });

    expect(onObjectPointerDown).not.toHaveBeenCalled();
    expect(circle.style.opacity).toBe('0.5');
    expect(circle.style.cursor).toBe('not-allowed');
  });
});
