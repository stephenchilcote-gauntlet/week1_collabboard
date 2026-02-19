import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Line from './Line.jsx';

const baseObject = {
  id: 'line-1',
  type: 'line',
  x1: 10,
  y1: 20,
  x2: 110,
  y2: 80,
  color: '#45B7D1',
  strokeWidth: 2,
  zIndex: 2,
};

const renderLine = (props = {}) => {
  const defaults = {
    object: baseObject,
    isSelected: false,
    isDragging: false,
    lockedByOther: false,
    onSelect: vi.fn(),
    onUpdate: vi.fn(),
    onDragStart: vi.fn(),
    zoom: 1,
    interactionMode: 'idle',
  };
  const merged = { ...defaults, ...props };
  return { ...render(<Line {...merged} />), ...merged };
};

describe('Line', () => {
  it('renders with data-object-id and stroke color', () => {
    const { getByTestId } = renderLine();

    const line = getByTestId('line-shape');
    expect(line.getAttribute('data-object-id')).toBe('line-1');
    const stroke = getByTestId('line-body').getAttribute('stroke');
    expect(stroke).toBe('#45B7D1');
  });

  it('pointerDown on body selects and starts drag', () => {
    const { getByTestId, onSelect, onDragStart } = renderLine();

    fireEvent.pointerDown(getByTestId('line-hit-area'), { clientX: 10, clientY: 10 });

    expect(onSelect).toHaveBeenCalledWith('line-1', expect.any(Object));
    expect(onDragStart).toHaveBeenCalled();
  });

  it('dragging an endpoint updates coordinates', () => {
    const { getByTestId, onUpdate } = renderLine({ isSelected: true });

    fireEvent.pointerDown(getByTestId('line-endpoint-start'), { clientX: 10, clientY: 20 });
    fireEvent.pointerMove(window, { clientX: 30, clientY: 40 });
    fireEvent.pointerUp(window, { clientX: 30, clientY: 40 });

    expect(onUpdate).toHaveBeenCalled();
    const update = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][1];
    expect(update.x1).toBe(30);
    expect(update.y1).toBe(40);
  });

  it('endpoint drag maps 1:1 in board coordinates when zoomed', () => {
    const { getByTestId, onUpdate } = renderLine({ isSelected: true, zoom: 2 });

    // pointerDown at clientX=10, clientY=20; drag 40px in screen space
    fireEvent.pointerDown(getByTestId('line-endpoint-start'), { clientX: 10, clientY: 20 });
    fireEvent.pointerMove(window, { clientX: 50, clientY: 60 });
    fireEvent.pointerUp(window);

    const update = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][1];
    // 40px screen ÷ zoom 2 = 20 board units; original x1=10, y1=20
    expect(update.x1).toBe(30);
    expect(update.y1).toBe(40);
  });

  it('lockedByOther blocks pointer events', () => {
    const { getByTestId, onSelect, onDragStart } = renderLine({ lockedByOther: true });

    fireEvent.pointerDown(getByTestId('line-hit-area'), { clientX: 10, clientY: 10 });

    expect(onSelect).not.toHaveBeenCalled();
    expect(onDragStart).not.toHaveBeenCalled();
  });
});
