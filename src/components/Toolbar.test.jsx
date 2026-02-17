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

  it('buttons highlight on hover', () => {
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

    const stickyBtn = getByText('Sticky Note');
    expect(stickyBtn.style.background).toContain('transparent');
    fireEvent.mouseEnter(stickyBtn);
    expect(stickyBtn.style.background).toContain('rgba');
    fireEvent.mouseLeave(stickyBtn);
    expect(stickyBtn.style.background).toContain('transparent');

    const rectBtn = getByText('Rectangle');
    expect(rectBtn.style.background).toContain('transparent');
    fireEvent.mouseEnter(rectBtn);
    expect(rectBtn.style.background).toContain('rgba');
    fireEvent.mouseLeave(rectBtn);
    expect(rectBtn.style.background).toContain('transparent');
  });

  it('S key creates a sticky note', () => {
    const onCreateSticky = vi.fn();
    const onCreateRectangle = vi.fn();
    const onDeleteSelected = vi.fn();

    render(
      <Toolbar
        onCreateSticky={onCreateSticky}
        onCreateRectangle={onCreateRectangle}
        onDeleteSelected={onDeleteSelected}
        selectedId={null}
        interactionMode="idle"
      />,
    );

    fireEvent.keyDown(window, { key: 's' });
    expect(onCreateSticky).toHaveBeenCalled();
  });

  it('R key creates a rectangle', () => {
    const onCreateSticky = vi.fn();
    const onCreateRectangle = vi.fn();
    const onDeleteSelected = vi.fn();

    render(
      <Toolbar
        onCreateSticky={onCreateSticky}
        onCreateRectangle={onCreateRectangle}
        onDeleteSelected={onDeleteSelected}
        selectedId={null}
        interactionMode="idle"
      />,
    );

    fireEvent.keyDown(window, { key: 'r' });
    expect(onCreateRectangle).toHaveBeenCalled();
  });

  it('keyboard shortcuts are disabled while editing', () => {
    const onCreateSticky = vi.fn();
    const onCreateRectangle = vi.fn();
    const onDeleteSelected = vi.fn();

    render(
      <Toolbar
        onCreateSticky={onCreateSticky}
        onCreateRectangle={onCreateRectangle}
        onDeleteSelected={onDeleteSelected}
        selectedId={null}
        interactionMode="editing"
      />,
    );

    fireEvent.keyDown(window, { key: 's' });
    expect(onCreateSticky).not.toHaveBeenCalled();
  });

  it('buttons have title attributes for discoverability', () => {
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

    expect(getByText('Sticky Note').getAttribute('title')).toBe('Add sticky note (S)');
    expect(getByText('Rectangle').getAttribute('title')).toBe('Add rectangle (R)');
  });
});
