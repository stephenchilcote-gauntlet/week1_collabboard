import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import SelectionMarquee from './SelectionMarquee.jsx';

describe('SelectionMarquee', () => {
  it('renders marquee rectangle with provided bounds', () => {
    const { getByTestId } = render(
      <SelectionMarquee
        bounds={{ x: 10, y: 20, width: 100, height: 80 }}
        zoom={1}
      />,
    );

    const marquee = getByTestId('selection-marquee');
    expect(marquee.style.left).toBe('10px');
    expect(marquee.style.top).toBe('20px');
    expect(marquee.style.width).toBe('100px');
    expect(marquee.style.height).toBe('80px');
  });
});
