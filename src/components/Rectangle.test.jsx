import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Rectangle from './Rectangle.jsx';

const defaultObject = { id: 'rect1', x: 10, y: 20, width: 120, height: 80, color: '#4ECDC4', zIndex: 2 };

function renderRect(props = {}) {
  const defaults = {
    object: defaultObject,
    isSelected: false,
    lockedByOther: false,
    onSelect: vi.fn(),
    onUpdate: vi.fn(),
    onDragStart: vi.fn(),
    onResizeStart: vi.fn(),
    zoom: 1,
  };
  const merged = { ...defaults, ...props };
  return { ...render(<Rectangle {...merged} />), ...merged };
}

describe('Rectangle', () => {
  it('renders with data-object-id and color', () => {
    const { getByTestId } = renderRect();

    const rect = getByTestId('rectangle');
    expect(rect.getAttribute('data-object-id')).toBe('rect1');
    expect(rect.style.background).toBe('rgb(78, 205, 196)');
  });

  describe('locked by another user', () => {
    it('blocks pointerDown — no select or drag', () => {
      const { getByTestId, onSelect, onDragStart } = renderRect({ lockedByOther: true });

      fireEvent.pointerDown(getByTestId('rectangle'), { clientX: 0, clientY: 0, pointerId: 1 });
      expect(onSelect).not.toHaveBeenCalled();
      expect(onDragStart).not.toHaveBeenCalled();
    });

    it('renders with reduced opacity and not-allowed cursor', () => {
      const { getByTestId } = renderRect({ lockedByOther: true });

      const rect = getByTestId('rectangle');
      expect(rect.style.opacity).toBe('0.5');
      expect(rect.style.cursor).toBe('not-allowed');
    });
  });
});
