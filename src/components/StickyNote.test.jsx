import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, queryByTestId } from '@testing-library/react';
import StickyNote from './StickyNote.jsx';

const defaultObject = { id: 'note1', x: 0, y: 0, width: 200, height: 150, text: 'Hello', color: '#FFD700', zIndex: 1 };

function renderNote(props = {}) {
  const defaults = {
    object: defaultObject,
    isSelected: false,
    onSelect: vi.fn(),
    onUpdate: vi.fn(),
    onDragStart: vi.fn(),
    onEditStateChange: vi.fn(),
    zoom: 1,
    interactionMode: 'idle',
  };
  const merged = { ...defaults, ...props };
  return { ...render(<StickyNote {...merged} />), ...merged };
}

describe('StickyNote', () => {
  it('renders with data-object-id and handles double click', () => {
    const { getByTestId, onUpdate } = renderNote();

    const note = getByTestId('sticky-note');
    expect(note.getAttribute('data-object-id')).toBe('note1');
    expect(note.style.width).toBe('200px');
    expect(note.style.height).toBe('150px');

    fireEvent.doubleClick(note);
    const textarea = getByTestId('sticky-editor');
    fireEvent.change(textarea, { target: { value: 'Updated' } });
    fireEvent.blur(textarea);

    expect(onUpdate).toHaveBeenCalledWith('note1', { text: 'Updated' });
  });

  it('enters edit mode on click when already selected', () => {
    const { getByTestId } = renderNote({ isSelected: true });

    const note = getByTestId('sticky-note');
    fireEvent.click(note);
    expect(getByTestId('sticky-editor')).toBeInTheDocument();
  });

  it('starts drag immediately when not selected', () => {
    const { getByTestId, onDragStart } = renderNote({ isSelected: false });

    const note = getByTestId('sticky-note');
    fireEvent.pointerDown(note, { clientX: 100, clientY: 100, pointerId: 1 });

    expect(onDragStart).toHaveBeenCalledTimes(1);
  });

  it('does not start drag on pointerDown when already selected', () => {
    const { getByTestId, onDragStart } = renderNote({ isSelected: true });

    const note = getByTestId('sticky-note');
    fireEvent.pointerDown(note, { clientX: 100, clientY: 100, pointerId: 1 });

    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('starts drag on selected note when pointer moves past threshold', () => {
    const { getByTestId, onDragStart } = renderNote({ isSelected: true });

    const note = getByTestId('sticky-note');
    fireEvent.pointerDown(note, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(onDragStart).not.toHaveBeenCalled();

    // Move past the 5px threshold
    fireEvent(document, new PointerEvent('pointermove', { clientX: 110, clientY: 100, bubbles: true }));
    expect(onDragStart).toHaveBeenCalledTimes(1);
  });

  it('does not start drag on selected note when pointer stays within threshold', () => {
    const { getByTestId, onDragStart } = renderNote({ isSelected: true });

    const note = getByTestId('sticky-note');
    fireEvent.pointerDown(note, { clientX: 100, clientY: 100, pointerId: 1 });

    // Move within the 5px threshold
    fireEvent(document, new PointerEvent('pointermove', { clientX: 102, clientY: 102, bubbles: true }));
    expect(onDragStart).not.toHaveBeenCalled();

    // Release — should remain a click, not a drag
    fireEvent(document, new PointerEvent('pointerup', { bubbles: true }));
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('cleans up pending drag listeners on pointerUp', () => {
    const { getByTestId } = renderNote({ isSelected: true });
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const note = getByTestId('sticky-note');
    fireEvent.pointerDown(note, { clientX: 100, clientY: 100, pointerId: 1 });

    fireEvent(document, new PointerEvent('pointerup', { bubbles: true }));

    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('does not enter edit mode or start drag when already editing', () => {
    const { getByTestId, onDragStart } = renderNote({ isSelected: true });

    // Enter edit mode
    const note = getByTestId('sticky-note');
    fireEvent.click(note);
    expect(getByTestId('sticky-editor')).toBeInTheDocument();

    // PointerDown while editing should not start drag
    onDragStart.mockClear();
    fireEvent.pointerDown(note, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it('does not fire onDragStart more than once per gesture past threshold', () => {
    const { getByTestId, onDragStart } = renderNote({ isSelected: true });

    const note = getByTestId('sticky-note');
    fireEvent.pointerDown(note, { clientX: 100, clientY: 100, pointerId: 1 });

    // First move past threshold triggers drag
    fireEvent(document, new PointerEvent('pointermove', { clientX: 110, clientY: 100, bubbles: true }));
    expect(onDragStart).toHaveBeenCalledTimes(1);

    // Subsequent moves should not trigger additional onDragStart calls
    fireEvent(document, new PointerEvent('pointermove', { clientX: 120, clientY: 100, bubbles: true }));
    fireEvent(document, new PointerEvent('pointermove', { clientX: 130, clientY: 100, bubbles: true }));
    expect(onDragStart).toHaveBeenCalledTimes(1);
  });

  it('cleans up pending drag listeners on unmount', () => {
    const { getByTestId, unmount } = renderNote({ isSelected: true });
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const note = getByTestId('sticky-note');
    fireEvent.pointerDown(note, { clientX: 100, clientY: 100, pointerId: 1 });

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('pointerup', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('does not overwrite draft text with remote changes while editing', () => {
    const object = { ...defaultObject, text: 'original' };
    const { getByTestId, rerender } = renderNote({ object, isSelected: true });

    // Enter edit mode and type
    const note = getByTestId('sticky-note');
    fireEvent.click(note);
    const textarea = getByTestId('sticky-editor');
    fireEvent.change(textarea, { target: { value: 'my local edits' } });
    expect(textarea.value).toBe('my local edits');

    // Simulate a remote update arriving while we're editing
    rerender(
      <StickyNote
        object={{ ...object, text: 'remote change' }}
        isSelected
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
        onDragStart={vi.fn()}
        onEditStateChange={vi.fn()}
        zoom={1}
      />,
    );

    // Draft should NOT be clobbered
    expect(getByTestId('sticky-editor').value).toBe('my local edits');
  });

  it('syncs draft text from object.text when not editing', () => {
    const object = { ...defaultObject, text: 'v1' };
    const { getByTestId, rerender, container } = renderNote({ object, isSelected: false });

    // Not editing — text should display in the div
    expect(getByTestId('sticky-note').textContent).toBe('v1');

    // Remote update while not editing should sync
    rerender(
      <StickyNote
        object={{ ...object, text: 'v2' }}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
        onDragStart={vi.fn()}
        onEditStateChange={vi.fn()}
        zoom={1}
      />,
    );

    expect(getByTestId('sticky-note').textContent).toBe('v2');

    // Enter edit mode — draft should reflect the synced value
    rerender(
      <StickyNote
        object={{ ...object, text: 'v2' }}
        isSelected
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
        onDragStart={vi.fn()}
        onEditStateChange={vi.fn()}
        zoom={1}
      />,
    );
    fireEvent.click(getByTestId('sticky-note'));
    expect(getByTestId('sticky-editor').value).toBe('v2');
  });

  it('does not fire onEditStateChange on initial mount', () => {
    const onEditStateChange = vi.fn();
    renderNote({ onEditStateChange });

    expect(onEditStateChange).not.toHaveBeenCalled();
  });

  it('fires onEditStateChange(true) when entering edit and (false) when leaving', () => {
    const onEditStateChange = vi.fn();
    const { getByTestId } = renderNote({ isSelected: true, onEditStateChange });

    // Should not fire on mount
    expect(onEditStateChange).not.toHaveBeenCalled();

    // Enter edit mode
    fireEvent.click(getByTestId('sticky-note'));
    expect(onEditStateChange).toHaveBeenCalledWith('note1', true);

    // Leave edit mode via blur
    fireEvent.blur(getByTestId('sticky-editor'));
    expect(onEditStateChange).toHaveBeenCalledWith('note1', false);
  });

  it('Escape blurs the textarea and commits the edit', () => {
    const { getByTestId, onUpdate } = renderNote({ isSelected: true });

    fireEvent.click(getByTestId('sticky-note'));
    const textarea = getByTestId('sticky-editor');
    fireEvent.change(textarea, { target: { value: 'escaped text' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });

    // Should have exited edit mode and committed
    expect(onUpdate).toHaveBeenCalledWith('note1', { text: 'escaped text' });
    expect(getByTestId('sticky-note').querySelector('textarea')).toBeNull();
  });

  it('stopsPropagation on keyDown inside editor so board shortcuts are blocked', () => {
    const { getByTestId } = renderNote({ isSelected: true });

    fireEvent.click(getByTestId('sticky-note'));
    const textarea = getByTestId('sticky-editor');

    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
    const stopSpy = vi.spyOn(event, 'stopPropagation');
    fireEvent(textarea, event);
    expect(stopSpy).toHaveBeenCalled();
  });

  it('handles paste and inserts text into draft', () => {
    const { getByTestId } = renderNote({ isSelected: true });

    fireEvent.click(getByTestId('sticky-note'));
    const textarea = getByTestId('sticky-editor');

    // Set initial text and cursor position
    fireEvent.change(textarea, { target: { value: 'abcdef' } });
    textarea.selectionStart = 3;
    textarea.selectionEnd = 3;

    fireEvent.paste(textarea, {
      clipboardData: { getData: () => 'XYZ' },
    });

    expect(textarea.value).toBe('abcXYZdef');
  });

  it('replaces selected text range on paste', () => {
    const { getByTestId } = renderNote({ isSelected: true });

    fireEvent.click(getByTestId('sticky-note'));
    const textarea = getByTestId('sticky-editor');

    fireEvent.change(textarea, { target: { value: 'abcdef' } });
    textarea.selectionStart = 1;
    textarea.selectionEnd = 4;

    fireEvent.paste(textarea, {
      clipboardData: { getData: () => 'REPLACED' },
    });

    expect(textarea.value).toBe('aREPLACEDef');
  });

  it('rapid pointerdowns on selected note do not leak listeners', () => {
    const { getByTestId, onDragStart } = renderNote({ isSelected: true });
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const note = getByTestId('sticky-note');

    // First pointerdown arms pending drag
    fireEvent.pointerDown(note, { clientX: 100, clientY: 100, pointerId: 1 });
    // Second pointerdown should clean up first set before adding new ones
    fireEvent.pointerDown(note, { clientX: 105, clientY: 105, pointerId: 2 });

    // The first set of listeners should have been removed
    const moveAdds = addSpy.mock.calls.filter(([type]) => type === 'pointermove');
    const moveRemoves = removeSpy.mock.calls.filter(([type]) => type === 'pointermove');
    expect(moveAdds.length).toBe(2);
    expect(moveRemoves.length).toBe(1);

    // Clean up the second set
    fireEvent(document, new PointerEvent('pointerup', { bubbles: true }));
    const finalRemoves = removeSpy.mock.calls.filter(([type]) => type === 'pointermove');
    expect(finalRemoves.length).toBe(2);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('selects the note on every pointerDown regardless of state', () => {
    const onSelect = vi.fn();
    const { getByTestId } = renderNote({ isSelected: false, onSelect });

    const note = getByTestId('sticky-note');
    fireEvent.pointerDown(note, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(onSelect).toHaveBeenCalledWith('note1', expect.any(Object));
  });

  describe('locked by another user', () => {
    it('blocks pointerDown — no select or drag', () => {
      const onSelect = vi.fn();
      const onDragStart = vi.fn();
      const { getByTestId } = renderNote({ lockedByOther: true, onSelect, onDragStart });

      fireEvent.pointerDown(getByTestId('sticky-note'), { clientX: 0, clientY: 0, pointerId: 1 });
      expect(onSelect).not.toHaveBeenCalled();
      expect(onDragStart).not.toHaveBeenCalled();
    });

    it('blocks click — does not enter edit mode', () => {
      const { getByTestId, queryByTestId } = renderNote({ lockedByOther: true, isSelected: false });

      fireEvent.click(getByTestId('sticky-note'));
      expect(queryByTestId('sticky-editor')).toBeNull();
    });

    it('renders with reduced opacity and not-allowed cursor', () => {
      const { getByTestId } = renderNote({ lockedByOther: true });

      const note = getByTestId('sticky-note');
      expect(note.style.opacity).toBe('0.5');
      expect(note.style.cursor).toBe('not-allowed');
    });
  });
});
