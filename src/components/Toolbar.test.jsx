import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Toolbar from './Toolbar.jsx';

describe('Toolbar', () => {
  it('fires create handlers', () => {
    const onCreateSticky = vi.fn();
    const onCreateRectangle = vi.fn();
    const onCreateCircle = vi.fn();
    const onCreateLine = vi.fn();
    const onCreateText = vi.fn();
    const onCreateFrame = vi.fn();
    const onDeleteSelected = vi.fn();
    const onEnterConnectorMode = vi.fn();

    const { getByText } = render(
      <Toolbar
        onCreateSticky={onCreateSticky}
        onCreateRectangle={onCreateRectangle}
        onCreateCircle={onCreateCircle}
        onCreateLine={onCreateLine}
        onCreateText={onCreateText}
        onCreateFrame={onCreateFrame}
        onDeleteSelected={onDeleteSelected}
        onEnterConnectorMode={onEnterConnectorMode}
        selectedId={null}
        interactionMode="idle"
      />,
    );

    fireEvent.click(getByText('Sticky').closest('button'));
    fireEvent.click(getByText('Rect').closest('button'));
    fireEvent.click(getByText('Circle').closest('button'));
    fireEvent.click(getByText('Line').closest('button'));
    fireEvent.click(getByText('Text').closest('button'));
    fireEvent.click(getByText('Frame').closest('button'));
    fireEvent.click(getByText('Connect').closest('button'));

    expect(onCreateSticky).toHaveBeenCalled();
    expect(onCreateRectangle).toHaveBeenCalled();
    expect(onCreateCircle).toHaveBeenCalled();
    expect(onCreateLine).toHaveBeenCalled();
    expect(onCreateText).toHaveBeenCalled();
    expect(onCreateFrame).toHaveBeenCalled();
    expect(onEnterConnectorMode).toHaveBeenCalled();
  });

  it('buttons highlight on hover', () => {
    const onCreateSticky = vi.fn();
    const onCreateRectangle = vi.fn();
    const onCreateCircle = vi.fn();
    const onCreateLine = vi.fn();
    const onCreateText = vi.fn();
    const onCreateFrame = vi.fn();
    const onDeleteSelected = vi.fn();
    const onEnterConnectorMode = vi.fn();

    const { getByText } = render(
      <Toolbar
        onCreateSticky={onCreateSticky}
        onCreateRectangle={onCreateRectangle}
        onCreateCircle={onCreateCircle}
        onCreateLine={onCreateLine}
        onCreateText={onCreateText}
        onCreateFrame={onCreateFrame}
        onDeleteSelected={onDeleteSelected}
        onEnterConnectorMode={onEnterConnectorMode}
        selectedId={null}
        interactionMode="idle"
      />,
    );

    const stickyBtn = getByText('Sticky').closest('button');
    expect(stickyBtn.style.background).toContain('transparent');
    fireEvent.mouseEnter(stickyBtn);
    expect(stickyBtn.style.background).toContain('rgba');
    fireEvent.mouseLeave(stickyBtn);
    expect(stickyBtn.style.background).toContain('transparent');

    const rectBtn = getByText('Rect').closest('button');
    fireEvent.mouseEnter(rectBtn);
    expect(rectBtn.style.background).toContain('rgba');
    fireEvent.mouseLeave(rectBtn);

    const circleBtn = getByText('Circle').closest('button');
    fireEvent.mouseEnter(circleBtn);
    expect(circleBtn.style.background).toContain('rgba');
    fireEvent.mouseLeave(circleBtn);

    const lineBtn = getByText('Line').closest('button');
    fireEvent.mouseEnter(lineBtn);
    expect(lineBtn.style.background).toContain('rgba');
    fireEvent.mouseLeave(lineBtn);

    const textBtn = getByText('Text').closest('button');
    fireEvent.mouseEnter(textBtn);
    expect(textBtn.style.background).toContain('rgba');
    fireEvent.mouseLeave(textBtn);

    const frameBtn = getByText('Frame').closest('button');
    fireEvent.mouseEnter(frameBtn);
    expect(frameBtn.style.background).toContain('rgba');
    fireEvent.mouseLeave(frameBtn);

    const connectorBtn = getByText('Connect').closest('button');
    fireEvent.mouseEnter(connectorBtn);
    expect(connectorBtn.style.background).toContain('rgba');
    fireEvent.mouseLeave(connectorBtn);
  });

  it('keyboard shortcuts create shapes', () => {
    const onCreateSticky = vi.fn();
    const onCreateRectangle = vi.fn();
    const onCreateCircle = vi.fn();
    const onCreateLine = vi.fn();
    const onCreateText = vi.fn();
    const onCreateFrame = vi.fn();
    const onDeleteSelected = vi.fn();
    const onEnterConnectorMode = vi.fn();

    render(
      <Toolbar
        onCreateSticky={onCreateSticky}
        onCreateRectangle={onCreateRectangle}
        onCreateCircle={onCreateCircle}
        onCreateLine={onCreateLine}
        onCreateText={onCreateText}
        onCreateFrame={onCreateFrame}
        onDeleteSelected={onDeleteSelected}
        onEnterConnectorMode={onEnterConnectorMode}
        selectedId={null}
        interactionMode="idle"
      />,
    );

    fireEvent.keyDown(window, { key: 's' });
    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.keyDown(window, { key: 'c' });
    fireEvent.keyDown(window, { key: 'l' });
    fireEvent.keyDown(window, { key: 't' });
    fireEvent.keyDown(window, { key: 'f' });
    fireEvent.keyDown(window, { key: 'k' });

    expect(onCreateSticky).toHaveBeenCalled();
    expect(onCreateRectangle).toHaveBeenCalled();
    expect(onCreateCircle).toHaveBeenCalled();
    expect(onCreateLine).toHaveBeenCalled();
    expect(onCreateText).toHaveBeenCalled();
    expect(onCreateFrame).toHaveBeenCalled();
    expect(onEnterConnectorMode).toHaveBeenCalled();
  });

  it('keyboard shortcuts are disabled while editing', () => {
    const onCreateSticky = vi.fn();

    render(
      <Toolbar
        onCreateSticky={onCreateSticky}
        onCreateRectangle={vi.fn()}
        onCreateCircle={vi.fn()}
        onCreateLine={vi.fn()}
        onCreateText={vi.fn()}
        onCreateFrame={vi.fn()}
        onDeleteSelected={vi.fn()}
        onEnterConnectorMode={vi.fn()}
        selectedId={null}
        interactionMode="editing"
      />,
    );

    fireEvent.keyDown(window, { key: 's' });
    expect(onCreateSticky).not.toHaveBeenCalled();
  });

  it('buttons have title attributes for discoverability', () => {
    const { getByText } = render(
      <Toolbar
        onCreateSticky={vi.fn()}
        onCreateRectangle={vi.fn()}
        onCreateCircle={vi.fn()}
        onCreateLine={vi.fn()}
        onCreateText={vi.fn()}
        onCreateFrame={vi.fn()}
        onDeleteSelected={vi.fn()}
        onEnterConnectorMode={vi.fn()}
        selectedId={null}
        interactionMode="idle"
      />,
    );

    expect(getByText('Sticky').closest('button').getAttribute('title')).toBe('Sticky (S)');
    expect(getByText('Rect').closest('button').getAttribute('title')).toBe('Rect (R)');
    expect(getByText('Circle').closest('button').getAttribute('title')).toBe('Circle (C)');
    expect(getByText('Line').closest('button').getAttribute('title')).toBe('Line (L)');
    expect(getByText('Text').closest('button').getAttribute('title')).toBe('Text (T)');
    expect(getByText('Frame').closest('button').getAttribute('title')).toBe('Frame (F)');
    expect(getByText('Connect').closest('button').getAttribute('title')).toBe('Connect (K)');
  });
});
