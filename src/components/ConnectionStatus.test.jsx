import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import ConnectionStatus from './ConnectionStatus.jsx';

const mockOnValue = vi.fn();
const mockRef = vi.fn();

vi.mock('../firebase/config.js', () => ({
  db: {},
  BOARD_ID: 'default',
}));

vi.mock('firebase/database', () => ({
  ref: (...args) => mockRef(...args),
  onValue: (...args) => mockOnValue(...args),
}));

describe('ConnectionStatus', () => {
  beforeEach(() => {
    mockOnValue.mockReset();
    mockRef.mockReset();
  });

  it('shows offline banner when disconnected', () => {
    mockOnValue.mockImplementation((_ref, callback) => {
      callback({ val: () => false });
      return vi.fn();
    });

    const { getByText } = render(<ConnectionStatus />);
    expect(getByText('Connection lost — reconnecting…')).toBeInTheDocument();
  });

  it('hides banner when connected', () => {
    mockOnValue.mockImplementation((_ref, callback) => {
      callback({ val: () => true });
      return vi.fn();
    });

    const { queryByText } = render(<ConnectionStatus />);
    expect(queryByText('Connection lost — reconnecting…')).toBeNull();
  });
});
