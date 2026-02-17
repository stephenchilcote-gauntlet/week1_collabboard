import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App.jsx';

describe('App', () => {
  it('renders sign-in screen when not authenticated', () => {
    render(<App />);
    expect(screen.getByText('CollabBoard')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
  });

  it('sign-in button highlights on hover', () => {
    render(<App />);
    const button = screen.getByText('Sign in with Google');
    expect(button.style.background).toContain('transparent');
    fireEvent.mouseEnter(button);
    expect(button.style.background).toContain('rgba');
    fireEvent.mouseLeave(button);
    expect(button.style.background).toContain('transparent');
  });
});
