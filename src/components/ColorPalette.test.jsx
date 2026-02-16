import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import ColorPalette from './ColorPalette.jsx';
import { OBJECT_COLORS } from '../utils/colors.js';

describe('ColorPalette', () => {
  it('renders swatches and calls change handler', () => {
    const onChangeColor = vi.fn();
    const { getAllByTestId } = render(
      <ColorPalette selectedObject={{ id: 'obj1', color: OBJECT_COLORS[0] }} onChangeColor={onChangeColor} />,
    );

    const swatches = getAllByTestId('color-swatch');
    fireEvent.click(swatches[1]);
    expect(onChangeColor).toHaveBeenCalledWith('obj1', OBJECT_COLORS[1]);
  });
});
