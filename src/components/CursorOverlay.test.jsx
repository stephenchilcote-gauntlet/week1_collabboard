import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import CursorOverlay from './CursorOverlay.jsx';

describe('CursorOverlay', () => {
  it('renders cursor labels within bounds', () => {
    const { getByText } = render(
      <CursorOverlay
        cursors={{ user1: { uid: 'user1', name: 'User 1', x: 10, y: 20 } }}
        viewport={{ panX: 0, panY: 0, zoom: 1, viewportWidth: 800, viewportHeight: 600 }}
      />,
    );

    expect(getByText('User 1')).toBeInTheDocument();
  });

  it('renders cursor arrow SVG for each remote cursor', () => {
    const { container } = render(
      <CursorOverlay
        cursors={{ user1: { uid: 'user1', name: 'User 1', x: 10, y: 20 } }}
        viewport={{ panX: 0, panY: 0, zoom: 1, viewportWidth: 800, viewportHeight: 600 }}
      />,
    );

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('hides the current user cursor', () => {
    const { queryByText, getByText } = render(
      <CursorOverlay
        cursors={{
          me: { uid: 'me', name: 'Me', x: 10, y: 20 },
          other: { uid: 'other', name: 'Other', x: 30, y: 40 },
        }}
        viewport={{ panX: 0, panY: 0, zoom: 1, viewportWidth: 800, viewportHeight: 600 }}
        currentUid="me"
      />,
    );

    expect(queryByText('Me')).not.toBeInTheDocument();
    expect(getByText('Other')).toBeInTheDocument();
  });
});
