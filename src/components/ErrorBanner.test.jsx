import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import ErrorBanner from './ErrorBanner.jsx';

describe('ErrorBanner', () => {
  it('renders message and dismisses', () => {
    const onDismiss = vi.fn();
    const { getByText } = render(<ErrorBanner message="Failed" onDismiss={onDismiss} />);

    expect(getByText('Failed')).toBeInTheDocument();
  });

  it('dismiss button highlights on hover', () => {
    const onDismiss = vi.fn();
    const { getByText } = render(<ErrorBanner message="Failed" onDismiss={onDismiss} />);

    const dismissBtn = getByText('Dismiss');
    expect(dismissBtn.style.background).toContain('transparent');
    fireEvent.mouseEnter(dismissBtn);
    expect(dismissBtn.style.background).toContain('rgba');
    fireEvent.mouseLeave(dismissBtn);
    expect(dismissBtn.style.background).toContain('transparent');
  });
});
