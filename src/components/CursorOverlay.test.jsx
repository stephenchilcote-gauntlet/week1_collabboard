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
});
