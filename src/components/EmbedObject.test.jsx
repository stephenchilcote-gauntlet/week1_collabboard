import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmbedObject, { buildSrcdoc } from './EmbedObject.jsx';

describe('buildSrcdoc', () => {
  it('wraps HTML in a full document with CSP', () => {
    const result = buildSrcdoc('<p>Hello</p>');
    expect(result).toContain('<!doctype html>');
    expect(result).toContain('Content-Security-Policy');
    expect(result).toContain("connect-src 'none'");
    expect(result).toContain('<p>Hello</p>');
  });

  it('includes base styles', () => {
    const result = buildSrcdoc('');
    expect(result).toContain('box-sizing:border-box');
    expect(result).toContain('margin:0');
  });
});

describe('EmbedObject', () => {
  const baseObject = {
    id: 'embed-1',
    type: 'embed',
    x: 100,
    y: 200,
    width: 400,
    height: 300,
    html: '<b>Test</b>',
    zIndex: 5,
  };

  it('renders an iframe with sandbox="allow-scripts"', () => {
    render(
      <EmbedObject
        object={baseObject}
        isSelected={false}
        isDragging={false}
        lockedByOther={false}
        onObjectPointerDown={vi.fn()}
        zoom={1}
      />,
    );

    const iframe = screen.getByTitle('Embed');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');
  });

  it('renders the container at the correct position', () => {
    render(
      <EmbedObject
        object={baseObject}
        isSelected={false}
        isDragging={false}
        lockedByOther={false}
        onObjectPointerDown={vi.fn()}
        zoom={1}
      />,
    );

    const container = screen.getByTestId('embed-object');
    expect(container.style.left).toBe('100px');
    expect(container.style.top).toBe('200px');
    expect(container.style.width).toBe('400px');
    expect(container.style.height).toBe('300px');
  });

  it('applies hover highlight', async () => {
    render(
      <EmbedObject
        object={baseObject}
        isSelected={false}
        isDragging={false}
        lockedByOther={false}
        onObjectPointerDown={vi.fn()}
        zoom={1}
      />,
    );

    const container = screen.getByTestId('embed-object');
    expect(container.style.boxShadow).toBe('none');
  });

  it('shows reduced opacity when locked by other', () => {
    render(
      <EmbedObject
        object={baseObject}
        isSelected={false}
        isDragging={false}
        lockedByOther={true}
        onObjectPointerDown={vi.fn()}
        zoom={1}
      />,
    );

    const container = screen.getByTestId('embed-object');
    expect(container.style.opacity).toBe('0.5');
  });
});
