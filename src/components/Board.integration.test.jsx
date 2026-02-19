import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import Board from './Board.jsx';
import { useSelection } from '../hooks/useSelection.js';
import { useDrag } from '../hooks/useDrag.js';

const mockOnValue = vi.fn();
vi.mock('../firebase/config.js', () => ({ db: {} }));
vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  onValue: (...args) => { mockOnValue(...args); return vi.fn(); },
  set: vi.fn(),
  remove: vi.fn(),
  onDisconnect: vi.fn(() => ({ remove: vi.fn(), cancel: vi.fn() })),
}));

/**
 * Wrapper that wires the real useSelection + useDrag hooks into <Board>,
 * replicating how App.jsx composes them.
 */
function BoardWithSelection({ objects }) {
  const boardRef = { current: makeFakeBoardEl() };
  const selection = useSelection(objects, null, [], 'test-board');
  const viewport = {
    panX: 0, panY: 0, zoom: 1, zoomPercent: 100,
    viewportWidth: 800, viewportHeight: 600, isPanning: false,
    handlePanStart: vi.fn(), handlePanMove: vi.fn(),
    handlePanEnd: vi.fn(), handleZoom: vi.fn(),
  };
  const updateObject = vi.fn();
  const {
    draggingId,
    handleDragStart: dragStart,
    handleDragMove,
    handleDragEnd,
  } = useDrag(viewport, updateObject, vi.fn());

  // Mirrors App.jsx handleDragStart.
  const handleDragStart = (object, containerX, containerY, selectedObjects) => {
    dragStart(object, containerX, containerY, selectedObjects);
  };

  return (
    <Board
      boardRef={boardRef}
      viewport={viewport}
      objects={objects}
      objectsLoaded
      user={{ uid: 'u1', displayName: 'Test' }}
      localCreatedIds={new Set()}
      selectedId={selection.selectedId}
      selectedIds={selection.selectedIds}
      draggingId={draggingId}
      onSetSelection={selection.setSelection}
      onClearSelection={selection.clearSelection}
      onUpdateObject={updateObject}
      onEditingChange={vi.fn()}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onResizeStart={vi.fn()}
      onResizeMove={vi.fn()}
      onResizeEnd={vi.fn()}
      onRotationStart={vi.fn()}
      onRotationMove={vi.fn()}
      onRotationEnd={vi.fn()}
      onConnectorCandidate={vi.fn()}
      connectorMode={false}
      connectorFromId={null}
      selectionBounds={selection.getSelectionBounds?.()}
      marqueeBounds={null}
      onMarqueeStart={vi.fn()}
      onMarqueeMove={vi.fn()}
      onMarqueeEnd={vi.fn()}
      onCursorMove={vi.fn()}
    />
  );
}

function makeFakeBoardEl() {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  };
}

const twoRects = {
  r1: { id: 'r1', type: 'rectangle', x: 10, y: 10, width: 80, height: 60, color: '#f00', zIndex: 1 },
  r2: { id: 'r2', type: 'rectangle', x: 200, y: 200, width: 80, height: 60, color: '#0f0', zIndex: 2 },
};

const twoStickies = {
  s1: { id: 's1', type: 'sticky', x: 10, y: 10, width: 200, height: 150, text: 'A', color: '#FFD700', zIndex: 1 },
  s2: { id: 's2', type: 'sticky', x: 300, y: 300, width: 200, height: 150, text: 'B', color: '#87CEEB', zIndex: 2 },
};

const threeStickies = {
  s1: { id: 's1', type: 'sticky', x: 10, y: 10, width: 200, height: 150, text: 'A', color: '#FFD700', zIndex: 1 },
  s2: { id: 's2', type: 'sticky', x: 300, y: 10, width: 200, height: 150, text: 'B', color: '#87CEEB', zIndex: 2 },
  s3: { id: 's3', type: 'sticky', x: 10, y: 300, width: 200, height: 150, text: 'C', color: '#98FB98', zIndex: 3 },
};

const mixedObjects = {
  s1: { id: 's1', type: 'sticky', x: 10, y: 10, width: 200, height: 150, text: 'A', color: '#FFD700', zIndex: 1 },
  r1: { id: 'r1', type: 'rectangle', x: 300, y: 300, width: 80, height: 60, color: '#f00', zIndex: 2 },
};

describe('Board + useSelection integration', () => {
  beforeEach(() => {
    mockOnValue.mockImplementation((_ref, cb) => {
      cb({ val: () => ({}) });
      return vi.fn();
    });
  });

  it('shift-click adds second rectangle to selection without losing the first', () => {
    const { getAllByTestId, getByTestId } = render(<BoardWithSelection objects={twoRects} />);
    const rects = getAllByTestId('rectangle');

    // Click first rectangle — should select it
    fireEvent.pointerDown(rects[0], { button: 0, clientX: 30, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(rects[0], { button: 0, clientX: 30, clientY: 30, pointerId: 1 });

    // Selection border should cover only r1
    let border = getByTestId('selection-border');
    expect(border.style.left).toBe('10px');
    expect(border.style.width).toBe('80px');

    // Shift-click second rectangle — should ADD it to selection
    fireEvent.pointerDown(rects[1], { button: 0, shiftKey: true, clientX: 220, clientY: 220, pointerId: 1 });
    fireEvent.pointerUp(rects[1], { button: 0, shiftKey: true, clientX: 220, clientY: 220, pointerId: 1 });

    // Selection border should now span both objects (r1 at 10,10 80x60 + r2 at 200,200 80x60)
    border = getByTestId('selection-border');
    expect(border.style.left).toBe('10px');
    expect(border.style.top).toBe('10px');
    expect(border.style.width).toBe('270px');
    expect(border.style.height).toBe('250px');
  });

  it('shift-click adds second sticky note to selection without losing the first', () => {
    const { getAllByTestId, getByTestId } = render(<BoardWithSelection objects={twoStickies} />);
    const notes = getAllByTestId('sticky-note');

    // Click first sticky — should select it
    fireEvent.pointerDown(notes[0], { button: 0, clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(notes[0], { button: 0, clientX: 50, clientY: 50, pointerId: 1 });

    let border = getByTestId('selection-border');
    expect(border.style.left).toBe('10px');
    expect(border.style.width).toBe('200px');

    // Shift-click second sticky — should ADD to selection
    fireEvent.pointerDown(notes[1], { button: 0, shiftKey: true, clientX: 350, clientY: 350, pointerId: 1 });
    fireEvent.pointerUp(notes[1], { button: 0, shiftKey: true, clientX: 350, clientY: 350, pointerId: 1 });

    // Should span both (s1 at 10,10 200x150 + s2 at 300,300 200x150)
    border = getByTestId('selection-border');
    expect(border.style.left).toBe('10px');
    expect(border.style.top).toBe('10px');
    expect(border.style.width).toBe('490px');
    expect(border.style.height).toBe('440px');
  });

  it('shift-click works across mixed object types', () => {
    const { getByTestId } = render(<BoardWithSelection objects={mixedObjects} />);
    const note = getByTestId('sticky-note');
    const rect = getByTestId('rectangle');

    // Click sticky
    fireEvent.pointerDown(note, { button: 0, clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(note, { button: 0, clientX: 50, clientY: 50, pointerId: 1 });

    // Shift-click rectangle
    fireEvent.pointerDown(rect, { button: 0, shiftKey: true, clientX: 320, clientY: 320, pointerId: 1 });
    fireEvent.pointerUp(rect, { button: 0, shiftKey: true, clientX: 320, clientY: 320, pointerId: 1 });

    // Should span both (s1 at 10,10 200x150 + r1 at 300,300 80x60)
    const border = getByTestId('selection-border');
    expect(border.style.left).toBe('10px');
    expect(border.style.top).toBe('10px');
    expect(border.style.width).toBe('370px');
    expect(border.style.height).toBe('350px');
  });

  it('shift-click a third note adds it without losing the first two', () => {
    const { getAllByTestId, getByTestId } = render(<BoardWithSelection objects={threeStickies} />);
    const notes = getAllByTestId('sticky-note');

    // Step 1: Click first note — select it
    fireEvent.pointerDown(notes[0], { button: 0, clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(notes[0], { button: 0, clientX: 50, clientY: 50, pointerId: 1 });

    let border = getByTestId('selection-border');
    expect(border.style.left).toBe('10px');
    expect(border.style.width).toBe('200px');
    expect(border.style.height).toBe('150px');

    // Step 2: Shift-click second note — adds to selection
    fireEvent.pointerDown(notes[1], { button: 0, shiftKey: true, clientX: 350, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(notes[1], { button: 0, shiftKey: true, clientX: 350, clientY: 50, pointerId: 1 });

    border = getByTestId('selection-border');
    // Should span s1 (10,10 200x150) + s2 (300,10 200x150)
    expect(border.style.left).toBe('10px');
    expect(border.style.top).toBe('10px');
    expect(border.style.width).toBe('490px');
    expect(border.style.height).toBe('150px');

    // Step 3: Shift-click third note — should ADD, keeping all three selected
    fireEvent.pointerDown(notes[2], { button: 0, shiftKey: true, clientX: 50, clientY: 350, pointerId: 1 });
    fireEvent.pointerUp(notes[2], { button: 0, shiftKey: true, clientX: 50, clientY: 350, pointerId: 1 });

    // Should span all three: s1(10,10), s2(300,10), s3(10,300) → (10,10) to (500,450)
    border = getByTestId('selection-border');
    expect(border.style.left).toBe('10px');
    expect(border.style.top).toBe('10px');
    expect(border.style.width).toBe('490px');
    expect(border.style.height).toBe('440px');
  });

  it('shift-click deselects an already-selected object', () => {
    const { getAllByTestId, getByTestId } = render(<BoardWithSelection objects={twoRects} />);
    const rects = getAllByTestId('rectangle');

    // Click first
    fireEvent.pointerDown(rects[0], { button: 0, clientX: 30, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(rects[0], { button: 0, clientX: 30, clientY: 30, pointerId: 1 });

    // Shift-click second
    fireEvent.pointerDown(rects[1], { button: 0, shiftKey: true, clientX: 220, clientY: 220, pointerId: 1 });
    fireEvent.pointerUp(rects[1], { button: 0, shiftKey: true, clientX: 220, clientY: 220, pointerId: 1 });

    // Shift-click first again to deselect it
    fireEvent.pointerDown(rects[0], { button: 0, shiftKey: true, clientX: 30, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(rects[0], { button: 0, shiftKey: true, clientX: 30, clientY: 30, pointerId: 1 });

    // Only second should be selected — border should match r2 bounds
    const border = getByTestId('selection-border');
    expect(border.style.left).toBe('200px');
    expect(border.style.top).toBe('200px');
    expect(border.style.width).toBe('80px');
    expect(border.style.height).toBe('60px');
  });
});
