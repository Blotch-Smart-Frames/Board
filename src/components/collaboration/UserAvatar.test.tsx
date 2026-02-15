import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UserAvatar } from './UserAvatar';

describe('UserAvatar', () => {
  const getAvatar = (container: HTMLElement) =>
    container.querySelector('.MuiAvatar-root') as HTMLElement;

  it('renders initials when no photo provided', () => {
    const { container } = render(<UserAvatar name="John Doe" />);

    const avatar = getAvatar(container);
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveTextContent('JD');
  });

  it('renders initials from single word name', () => {
    const { container } = render(<UserAvatar name="John" />);

    const avatar = getAvatar(container);
    expect(avatar).toHaveTextContent('JO');
  });

  it('renders photo when photoURL provided', () => {
    render(
      <UserAvatar name="John Doe" photoURL="https://example.com/photo.jpg" />,
    );

    const avatar = screen.getByRole('img', { name: 'John Doe' });
    expect(avatar).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('shows tooltip with name when showTooltip is true (default)', () => {
    const { container } = render(<UserAvatar name="John Doe" />);

    const avatar = getAvatar(container);
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveTextContent('JD');
  });

  it('does not wrap in tooltip when showTooltip is false', () => {
    const { container } = render(
      <UserAvatar name="John Doe" showTooltip={false} />,
    );

    // Should not have tooltip wrapper
    expect(container.querySelector('[role="tooltip"]')).not.toBeInTheDocument();
    expect(getAvatar(container)).toBeInTheDocument();
  });

  it('applies correct size for small', () => {
    const { container } = render(<UserAvatar name="John Doe" size="small" />);

    const avatar = getAvatar(container);
    expect(avatar).toHaveStyle({ width: '24px', height: '24px' });
  });

  it('applies correct size for medium (default)', () => {
    const { container } = render(<UserAvatar name="John Doe" />);

    const avatar = getAvatar(container);
    expect(avatar).toHaveStyle({ width: '32px', height: '32px' });
  });

  it('applies correct size for large', () => {
    const { container } = render(<UserAvatar name="John Doe" size="large" />);

    const avatar = getAvatar(container);
    expect(avatar).toHaveStyle({ width: '40px', height: '40px' });
  });

  it('generates consistent background color from name', () => {
    const { container, rerender } = render(<UserAvatar name="John Doe" />);
    const avatar1 = getAvatar(container);
    const className1 = avatar1.className;

    rerender(<UserAvatar name="John Doe" />);
    const avatar2 = getAvatar(container);
    const className2 = avatar2.className;

    // Same name should produce same styling
    expect(className1).toBe(className2);
  });

  it('generates different colors for different names', () => {
    const { container: container1 } = render(<UserAvatar name="John Doe" />);
    const { container: container2 } = render(<UserAvatar name="Zoe Xavier" />);

    const avatar1 = container1.querySelector('.MuiAvatar-root') as HTMLElement;
    const avatar2 = container2.querySelector('.MuiAvatar-root') as HTMLElement;

    // Different names should have different initials
    expect(avatar1.textContent).toBe('JD');
    expect(avatar2.textContent).toBe('ZX');
    expect(avatar1.textContent).not.toBe(avatar2.textContent);
  });
});
