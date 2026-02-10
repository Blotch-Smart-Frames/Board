import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LabelChip } from './LabelChip';
import type { Label } from '../../types/board';
import { Timestamp } from 'firebase/firestore';

const createMockLabel = (overrides: Partial<Label> = {}): Label => ({
  id: 'label-1',
  name: 'Urgent',
  color: '#EF4444',
  emoji: '⚡',
  order: 0,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...overrides,
});

describe('LabelChip', () => {
  it('renders label name', () => {
    const label = createMockLabel({ name: 'Bug' });
    render(<LabelChip label={label} />);

    expect(screen.getByText('Bug')).toBeInTheDocument();
  });

  it('renders emoji when provided', () => {
    const label = createMockLabel({ emoji: '🔥', name: 'Hot' });
    render(<LabelChip label={label} />);

    expect(screen.getByText('🔥')).toBeInTheDocument();
    expect(screen.getByText('Hot')).toBeInTheDocument();
  });

  it('does not render emoji when not provided', () => {
    const label = createMockLabel({ emoji: undefined, name: 'Plain' });
    render(<LabelChip label={label} />);

    expect(screen.getByText('Plain')).toBeInTheDocument();
    expect(screen.queryByText('⚡')).not.toBeInTheDocument();
  });

  it('applies background color from label', () => {
    const label = createMockLabel({ color: '#3B82F6' });
    const { container } = render(<LabelChip label={label} />);

    const chip = container.querySelector('.MuiChip-root') as HTMLElement;
    expect(chip).toHaveStyle({ backgroundColor: '#3B82F6' });
  });

  it('applies light text color on dark background', () => {
    const label = createMockLabel({ color: '#1E3A5F' });
    const { container } = render(<LabelChip label={label} />);

    const chip = container.querySelector('.MuiChip-root') as HTMLElement;
    expect(chip).toHaveStyle({ color: 'rgb(255, 255, 255)' });
  });

  it('applies dark text color on light background', () => {
    const label = createMockLabel({ color: '#FBBF24' });
    const { container } = render(<LabelChip label={label} />);

    const chip = container.querySelector('.MuiChip-root') as HTMLElement;
    expect(chip).toHaveStyle({ color: 'rgb(0, 0, 0)' });
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    const label = createMockLabel();
    render(<LabelChip label={label} onClick={handleClick} />);

    await user.click(screen.getByText(label.name));

    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('shows delete icon and calls onDelete when deleted', async () => {
    const user = userEvent.setup();
    const handleDelete = vi.fn();
    const label = createMockLabel();
    const { container } = render(
      <LabelChip label={label} onDelete={handleDelete} />,
    );

    const deleteIcon = container.querySelector(
      '.MuiChip-deleteIcon',
    ) as HTMLElement;
    expect(deleteIcon).toBeInTheDocument();

    await user.click(deleteIcon);
    expect(handleDelete).toHaveBeenCalledOnce();
  });

  it('does not show delete icon when onDelete is not provided', () => {
    const label = createMockLabel();
    const { container } = render(<LabelChip label={label} />);

    expect(
      container.querySelector('.MuiChip-deleteIcon'),
    ).not.toBeInTheDocument();
  });

  it('renders with small size by default', () => {
    const label = createMockLabel();
    const { container } = render(<LabelChip label={label} />);

    const chip = container.querySelector('.MuiChip-root') as HTMLElement;
    expect(chip).toHaveClass('MuiChip-sizeSmall');
  });

  it('renders with medium size when specified', () => {
    const label = createMockLabel();
    const { container } = render(<LabelChip label={label} size="medium" />);

    const chip = container.querySelector('.MuiChip-root') as HTMLElement;
    expect(chip).toHaveClass('MuiChip-sizeMedium');
  });
});
