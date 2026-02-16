import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import Rectangle from './Rectangle.jsx';

describe('Rectangle', () => {
  it('renders with data-object-id and color', () => {
    const { getByTestId } = render(
      <Rectangle
        object={{ id: 'rect1', x: 10, y: 20, width: 120, height: 80, color: '#4ECDC4', zIndex: 2 }}
        isSelected={false}
        onSelect={() => {}}
        onUpdate={() => {}}
        onDragStart={() => {}}
        onResizeStart={() => {}}
        zoom={1}
      />,
    );

    const rect = getByTestId('rectangle');
    expect(rect.getAttribute('data-object-id')).toBe('rect1');
    expect(rect.style.background).toBe('rgb(78, 205, 196)');
  });
});
