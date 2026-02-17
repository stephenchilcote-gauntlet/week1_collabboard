import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Connector from './Connector.jsx';

const objects = {
  a: { id: 'a', x: 10, y: 20, width: 100, height: 60 },
  b: { id: 'b', x: 200, y: 140, width: 80, height: 40 },
};

const renderConnector = (props = {}) => {
  const defaults = {
    connector: { id: 'conn-1', fromId: 'a', toId: 'b', style: 'line', color: '#111827', zIndex: 1 },
    objects,
    onSelect: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  return { ...render(<Connector {...merged} />), ...merged };
};

describe('Connector', () => {
  it('renders between object centers', () => {
    const { getByTestId } = renderConnector();
    const line = getByTestId('connector-line');
    expect(line.getAttribute('x1')).toBe('60');
    expect(line.getAttribute('y1')).toBe('50');
    expect(line.getAttribute('x2')).toBe('240');
    expect(line.getAttribute('y2')).toBe('160');
  });

  it('updates when object positions change', () => {
    const { getByTestId, rerender } = renderConnector();

    rerender(
      <Connector
        connector={{ id: 'conn-1', fromId: 'a', toId: 'b', style: 'line', color: '#111827', zIndex: 1 }}
        objects={{
          a: { id: 'a', x: 20, y: 40, width: 100, height: 60 },
          b: { id: 'b', x: 220, y: 160, width: 80, height: 40 },
        }}
        onSelect={vi.fn()}
      />,
    );

    const line = getByTestId('connector-line');
    expect(line.getAttribute('x1')).toBe('70');
    expect(line.getAttribute('y1')).toBe('70');
  });

  it('renders arrowhead when style is arrow', () => {
    const { getByTestId } = renderConnector({
      connector: { id: 'conn-1', fromId: 'a', toId: 'b', style: 'arrow', color: '#111827', zIndex: 1 },
    });

    const marker = getByTestId('connector-arrow');
    expect(marker).toBeInTheDocument();
  });

  it('calls onSelect on pointerDown', () => {
    const { getByTestId, onSelect } = renderConnector();

    fireEvent.pointerDown(getByTestId('connector-hitbox'));
    expect(onSelect).toHaveBeenCalledWith('conn-1');
  });
});
