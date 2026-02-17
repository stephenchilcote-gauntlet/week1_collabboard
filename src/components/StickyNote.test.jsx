import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import StickyNote from './StickyNote.jsx';

describe('StickyNote', () => {
  it('renders with data-object-id and handles double click', () => {
    const onUpdate = vi.fn();
    const onSelect = vi.fn();
    const { getByTestId } = render(
      <StickyNote
        object={{ id: 'note1', x: 0, y: 0, width: 200, height: 150, text: 'Hello', color: '#FFD700', zIndex: 1 }}
        isSelected={false}
        onSelect={onSelect}
        onUpdate={onUpdate}
        onDragStart={vi.fn()}
        onEditStateChange={vi.fn()}
        zoom={1}
      />,
    );

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
    const { getByTestId } = render(
      <StickyNote
        object={{ id: 'note1', x: 0, y: 0, width: 200, height: 150, text: 'Hello', color: '#FFD700', zIndex: 1 }}
        isSelected
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
        onDragStart={vi.fn()}
        onEditStateChange={vi.fn()}
        zoom={1}
      />,
    );

    const note = getByTestId('sticky-note');
    fireEvent.click(note);
    expect(getByTestId('sticky-editor')).toBeInTheDocument();
  });
});
