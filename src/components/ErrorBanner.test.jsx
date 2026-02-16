import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import ErrorBanner from './ErrorBanner.jsx';

describe('ErrorBanner', () => {
  it('renders message and dismisses', () => {
    const onDismiss = vi.fn();
    const { getByText } = render(<ErrorBanner message="Failed" onDismiss={onDismiss} />);

    expect(getByText('Failed')).toBeInTheDocument();
  });
});
