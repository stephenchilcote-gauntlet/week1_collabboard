import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Board from './Board.jsx';

const handlePanStart = vi.fn();
const handlePanMove = vi.fn();
const handlePanEnd = vi.fn();
const handleZoom = vi.fn();

vi.mock('../hooks/useViewport.js', () => ({
  useViewport: vi.fn(() => ({
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
  })),
}));

describe('Board', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders board structure and dot grid', () => {
    const { getByTestId } = render(<Board />);
    const outer = getByTestId('board-outer');
    const inner = getByTestId('board-inner');

    expect(outer).toBeInTheDocument();
    expect(inner).toBeInTheDocument();
    expect(inner.style.backgroundImage).toContain('radial-gradient');
  });

  it('routes pointer down to pan when clicking empty space', () => {
    const { getByTestId } = render(<Board />);
    const outer = getByTestId('board-outer');

    fireEvent.pointerDown(outer, { button: 0, clientX: 10, clientY: 20, pointerId: 7 });

    expect(handlePanStart).toHaveBeenCalled();
  });
});
