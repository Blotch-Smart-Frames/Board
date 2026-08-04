import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BoardBackground } from './BoardBackground';

describe('BoardBackground', () => {
  it('renders children', () => {
    render(
      <BoardBackground>
        <div>Board Content</div>
      </BoardBackground>,
    );

    expect(screen.getByText('Board Content')).toBeInTheDocument();
  });

  it('renders without background image by default', () => {
    const { container } = render(
      <BoardBackground>
        <div>Content</div>
      </BoardBackground>,
    );

    // Should not have background image style
    const root = container.firstChild as HTMLElement;
    expect(root.style.backgroundImage).toBeFalsy();
  });

  it('renders overlay when imageUrl provided (confirms bg styling path)', () => {
    const { container } = render(
      <BoardBackground imageUrl="https://example.com/bg.jpg">
        <div>Content</div>
      </BoardBackground>,
    );

    // When imageUrl is provided, an overlay div is added (2 children)
    const root = container.firstChild as HTMLElement;
    expect(root.children.length).toBe(2);
  });

  it('passes children through with image URL', () => {
    render(
      <BoardBackground imageUrl="https://example.com/bg.jpg">
        <div>Visible Content</div>
      </BoardBackground>,
    );

    expect(screen.getByText('Visible Content')).toBeInTheDocument();
  });

  it('does not render overlay when no imageUrl', () => {
    const { container } = render(
      <BoardBackground>
        <div>Content</div>
      </BoardBackground>,
    );

    const root = container.firstChild as HTMLElement;
    expect(root.children.length).toBe(1); // just content wrapper
  });
});
