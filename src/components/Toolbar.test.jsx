import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Toolbar from './Toolbar.jsx';

describe('Toolbar', () => {
  it('fires create handlers', () => {
    const onCreateSticky = vi.fn();
    const onCreateRectangle = vi.fn();
    const onDeleteSelected = vi.fn();

    const { getByText } = render(
      <Toolbar
        onCreateSticky={onCreateSticky}
        onCreateRectangle={onCreateRectangle}
        onDeleteSelected={onDeleteSelected}
        selectedId={null}
        interactionMode="idle"
      />,
    );

    fireEvent.click(getByText('Sticky Note'));
    fireEvent.click(getByText('Rectangle'));

    expect(onCreateSticky).toHaveBeenCalled();
    expect(onCreateRectangle).toHaveBeenCalled();
  });
});
