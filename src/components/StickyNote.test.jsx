import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import StickyNote from './StickyNote.jsx';

const defaultObject = { id: 'note1', x: 0, y: 0, width: 200, height: 150, text: 'Hello', color: '#FFD700', zIndex: 1 };

function renderNote(props = {}) {
  const defaults = {
    object: defaultObject,
    isDragging: false,
    lockedByOther: false,
    onObjectPointerDown: vi.fn(),
    onUpdate: vi.fn(),
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

  it('enters edit mode on click', () => {
    const { getByTestId } = renderNote();

    const note = getByTestId('sticky-note');
    fireEvent.click(note);
    expect(getByTestId('sticky-editor')).toBeInTheDocument();
  });

  it('calls onObjectPointerDown on pointerDown', () => {
    const { getByTestId, onObjectPointerDown } = renderNote();

    const note = getByTestId('sticky-note');
    fireEvent.pointerDown(note, { clientX: 100, clientY: 100, pointerId: 1 });

    expect(onObjectPointerDown).toHaveBeenCalledWith(defaultObject, expect.any(Object));
  });

  it('does not call onObjectPointerDown when editing', () => {
    const { getByTestId, onObjectPointerDown } = renderNote();

    const note = getByTestId('sticky-note');
    fireEvent.click(note);
    expect(getByTestId('sticky-editor')).toBeInTheDocument();

    fireEvent.pointerDown(note, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(onObjectPointerDown).not.toHaveBeenCalled();
  });

  it('does not call onObjectPointerDown when in connector mode', () => {
    const { getByTestId, onObjectPointerDown } = renderNote({ interactionMode: 'connecting' });

    const note = getByTestId('sticky-note');
    fireEvent.pointerDown(note, { clientX: 100, clientY: 100, pointerId: 1 });

    expect(onObjectPointerDown).not.toHaveBeenCalled();
  });

  it('does not overwrite draft text with remote changes while editing', () => {
    const object = { ...defaultObject, text: 'original' };
    const { getByTestId, rerender } = renderNote({ object });

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
        onObjectPointerDown={vi.fn()}
        onUpdate={vi.fn()}
        onEditStateChange={vi.fn()}
        zoom={1}
      />,
    );

    // Draft should NOT be clobbered
    expect(getByTestId('sticky-editor').value).toBe('my local edits');
  });

  it('syncs draft text from object.text when not editing', () => {
    const object = { ...defaultObject, text: 'v1' };
    const { getByTestId, rerender } = renderNote({ object });

    // Not editing — text should display in the div
    expect(getByTestId('sticky-note').textContent).toBe('v1');

    // Remote update while not editing should sync
    rerender(
      <StickyNote
        object={{ ...object, text: 'v2' }}
        onObjectPointerDown={vi.fn()}
        onUpdate={vi.fn()}
        onEditStateChange={vi.fn()}
        zoom={1}
      />,
    );

    expect(getByTestId('sticky-note').textContent).toBe('v2');

    // Enter edit mode — draft should reflect the synced value
    rerender(
      <StickyNote
        object={{ ...object, text: 'v2' }}
        onObjectPointerDown={vi.fn()}
        onUpdate={vi.fn()}
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
    const { getByTestId } = renderNote({ onEditStateChange });

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
    const { getByTestId, onUpdate } = renderNote();

    fireEvent.click(getByTestId('sticky-note'));
    const textarea = getByTestId('sticky-editor');
    fireEvent.change(textarea, { target: { value: 'escaped text' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });

    // Should have exited edit mode and committed
    expect(onUpdate).toHaveBeenCalledWith('note1', { text: 'escaped text' });
    expect(getByTestId('sticky-note').querySelector('textarea')).toBeNull();
  });

  it('stopsPropagation on keyDown inside editor so board shortcuts are blocked', () => {
    const { getByTestId } = renderNote();

    fireEvent.click(getByTestId('sticky-note'));
    const textarea = getByTestId('sticky-editor');

    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
    const stopSpy = vi.spyOn(event, 'stopPropagation');
    fireEvent(textarea, event);
    expect(stopSpy).toHaveBeenCalled();
  });

  it('handles paste and inserts text into draft', () => {
    const { getByTestId } = renderNote();

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
    const { getByTestId } = renderNote();

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

  describe('locked by another user', () => {
    it('blocks pointerDown — no select or drag', () => {
      const onObjectPointerDown = vi.fn();
      const { getByTestId } = renderNote({ lockedByOther: true, onObjectPointerDown });

      fireEvent.pointerDown(getByTestId('sticky-note'), { clientX: 0, clientY: 0, pointerId: 1 });
      expect(onObjectPointerDown).not.toHaveBeenCalled();
    });

    it('blocks click — does not enter edit mode', () => {
      const { getByTestId, queryByTestId } = renderNote({ lockedByOther: true });

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
