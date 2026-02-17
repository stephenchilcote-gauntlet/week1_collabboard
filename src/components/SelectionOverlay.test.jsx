import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import SelectionOverlay from './SelectionOverlay.jsx';

describe('SelectionOverlay', () => {
  it('renders border with selection color', () => {
    const { getByTestId } = render(
      <SelectionOverlay object={{ x: 10, y: 20, width: 100, height: 80 }} isResizable={false} zoom={1} />,
    );
    expect(getByTestId('selection-border')).toBeInTheDocument();
  });

  it('renders resize handles for rectangles sized by zoom', () => {
    const { getAllByTestId } = render(
      <SelectionOverlay object={{ x: 0, y: 0, width: 100, height: 80 }} isResizable zoom={2} />,
    );
    const handles = getAllByTestId('resize-handle');
    expect(handles).toHaveLength(8);
    expect(handles[0].style.width).toBe('4px');
  });

  it('positions overlay above the object z-index', () => {
    const { getByTestId } = render(
      <SelectionOverlay object={{ x: 0, y: 0, width: 100, height: 80, zIndex: 7 }} isResizable zoom={1} />,
    );
    const overlay = getByTestId('selection-border');
    expect(overlay.style.zIndex).toBe('8');
  });

  it('renders rotation handle when enabled', () => {
    const { getByTestId } = render(
      <SelectionOverlay object={{ x: 0, y: 0, width: 100, height: 80 }} isResizable zoom={1} showRotation />,
    );

    expect(getByTestId('rotation-handle')).toBeInTheDocument();
  });
});
