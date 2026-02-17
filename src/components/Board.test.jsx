import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import Board from './Board.jsx';

const handlePanStart = vi.fn();
const handlePanMove = vi.fn();
const handlePanEnd = vi.fn();
const handleZoom = vi.fn();

const baseProps = {
  boardRef: { current: { getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() } },
  viewport: {
    panX: 0,
    panY: 0,
    zoom: 1,
    zoomPercent: 100,
    viewportWidth: 800,
    viewportHeight: 600,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    handleZoom,
  },
  objects: {},
  objectsLoaded: true,
  user: { uid: 'user-1', displayName: 'Alex' },
  localCreatedIds: new Set(),
  selectedId: null,
  onSelect: vi.fn(),
  onClearSelection: vi.fn(),
  onUpdateObject: vi.fn(),
  onEditingChange: vi.fn(),
  onDragStart: vi.fn(),
  onDragMove: vi.fn(),
  onDragEnd: vi.fn(),
  onResizeStart: vi.fn(),
  onResizeMove: vi.fn(),
  onResizeEnd: vi.fn(),
  onCursorMove: vi.fn(),
};

describe('Board', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders board structure and dot grid', () => {
    const { getByTestId } = render(<Board {...baseProps} />);
    const outer = getByTestId('board-outer');
    const inner = getByTestId('board-inner');

    expect(outer).toBeInTheDocument();
    expect(inner).toBeInTheDocument();
    expect(inner.style.backgroundImage).toContain('radial-gradient');
  });

  it('routes pointer down to pan when clicking empty space', () => {
    const { getByTestId } = render(<Board {...baseProps} />);
    const outer = getByTestId('board-outer');

    fireEvent.pointerDown(outer, { button: 0, clientX: 10, clientY: 20, pointerId: 7 });

    expect(handlePanStart).toHaveBeenCalled();
  });

  it('highlights newly synced remote objects', async () => {
    const { rerender, getByTestId } = render(<Board {...baseProps} objects={{}} />);

    rerender(
      <Board
        {...baseProps}
        objects={{
          remote1: {
            id: 'remote1',
            type: 'sticky',
            x: 10,
            y: 10,
            width: 200,
            height: 150,
            text: 'Hello',
            color: '#FFD700',
            zIndex: 1,
          },
        }}
      />,
    );

    await waitFor(() => {
      const note = getByTestId('sticky-note');
      expect(note.style.opacity).toBe('0');
    });
  });

  it('shows a selection label when an object is locked by another user', () => {
    const { getByTestId } = render(
      <Board
        {...baseProps}
        lockedObjectIds={{ remote1: { uid: 'other', name: 'Taylor' } }}
        objects={{
          remote1: {
            id: 'remote1',
            type: 'rectangle',
            x: 10,
            y: 10,
            width: 120,
            height: 80,
            color: '#4ECDC4',
            zIndex: 1,
          },
        }}
      />,
    );

    const label = getByTestId('remote-selection-label');
    expect(label).toBeInTheDocument();
    expect(label.textContent).toBe('Taylor');
  });

  it('notifies when remote changes happen off screen', async () => {
    const { rerender, getByTestId } = render(<Board {...baseProps} objects={{}} />);

    rerender(
      <Board
        {...baseProps}
        objects={{
          remote1: {
            id: 'remote1',
            type: 'sticky',
            x: 900,
            y: 900,
            width: 200,
            height: 150,
            text: 'Off screen',
            color: '#FFD700',
            zIndex: 1,
            updatedBy: 'other',
            updatedByName: 'Jamie',
            updatedAt: Date.now(),
          },
        }}
        viewport={{
          ...baseProps.viewport,
          viewportWidth: 300,
          viewportHeight: 200,
        }}
      />,
    );

    await waitFor(() => {
      expect(getByTestId('remote-change-toast')).toBeInTheDocument();
    });
  });

  it('renders selection overlay with resize handles for sticky notes', () => {
    const { getAllByTestId } = render(
      <Board
        {...baseProps}
        selectedId="note1"
        objects={{
          note1: {
            id: 'note1',
            type: 'sticky',
            x: 10,
            y: 10,
            width: 200,
            height: 150,
            text: 'Hello',
            color: '#FFD700',
            zIndex: 1,
          },
        }}
      />,
    );

    expect(getAllByTestId('resize-handle')).toHaveLength(8);
  });
});
