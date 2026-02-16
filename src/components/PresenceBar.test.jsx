import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import PresenceBar from './PresenceBar.jsx';

describe('PresenceBar', () => {
  it('renders presence entries with you label', () => {
    const { getByText } = render(
      <PresenceBar
        presenceList={[{ uid: 'u1', name: 'Alice', photoURL: null }]}
        currentUid="u1"
      />,
    );

    expect(getByText('Alice (You)')).toBeInTheDocument();
  });
});
