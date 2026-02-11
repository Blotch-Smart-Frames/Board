import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { LabelEditor } from './LabelEditor';
import { labelColors } from '../../config/defaultLabels';
import type { Label } from '../../types/board';

const mockTimestamp = {
  toDate: () => new Date(),
} as Timestamp;

const mockLabel: Label = {
  id: 'label-1',
  name: 'Bug',
  color: '#EF4444',
  emoji: '🐛',
  order: 'a0',
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
};

describe('LabelEditor', () => {
  const defaultProps = {
    open: true,
    label: null,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
  };

  it('renders create mode when no label provided', () => {
    render(<LabelEditor {...defaultProps} />);

    expect(screen.getByText('Create Label')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('renders edit mode when label is provided', () => {
    render(<LabelEditor {...defaultProps} label={mockLabel} />);

    expect(screen.getByText('Edit Label')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('populates fields with label data when editing', () => {
    render(<LabelEditor {...defaultProps} label={mockLabel} />);

    expect(screen.getByLabelText(/name/i)).toHaveValue('Bug');
    expect(screen.getByLabelText(/emoji/i)).toHaveValue('🐛');
  });

  it('starts with empty fields when creating', () => {
    render(<LabelEditor {...defaultProps} />);

    expect(screen.getByLabelText(/name/i)).toHaveValue('');
    expect(screen.getByLabelText(/emoji/i)).toHaveValue('');
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<LabelEditor {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close icon button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<LabelEditor {...defaultProps} onClose={onClose} />);

    // Close icon button is inside DialogTitle
    const closeButtons = screen.getAllByRole('button');
    const closeIconButton = closeButtons.find(
      (btn) => btn.querySelector('[data-testid="CloseIcon"]') !== null,
    );
    expect(closeIconButton).toBeDefined();

    await user.click(closeIconButton!);

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSave with trimmed form data on submit', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<LabelEditor {...defaultProps} onSave={onSave} />);

    await user.type(screen.getByLabelText(/name/i), 'Feature');
    await user.type(screen.getByLabelText(/emoji/i), '✨');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        name: 'Feature',
        color: labelColors[0],
        emoji: '✨',
      });
    });
  });

  it('trims whitespace from name and emoji', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<LabelEditor {...defaultProps} onSave={onSave} />);

    await user.type(screen.getByLabelText(/name/i), '  Feature  ');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Feature' }),
      );
    });
  });

  it('omits emoji when empty', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<LabelEditor {...defaultProps} onSave={onSave} />);

    await user.type(screen.getByLabelText(/name/i), 'Bug');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ emoji: undefined }),
      );
    });
  });

  it('calls onClose after successful save', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<LabelEditor {...defaultProps} onClose={onClose} onSave={onSave} />);

    await user.type(screen.getByLabelText(/name/i), 'Bug');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('renders nothing visible when open is false', () => {
    const { container } = render(
      <LabelEditor {...defaultProps} open={false} />,
    );

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows a live preview of the label', () => {
    render(<LabelEditor {...defaultProps} label={mockLabel} />);

    // The preview LabelChip should show the label name
    const chips = screen.getAllByText('Bug');
    expect(chips.length).toBeGreaterThanOrEqual(1);
  });

  it('shows validation error when name is blank and field is touched', async () => {
    const user = userEvent.setup();
    render(<LabelEditor {...defaultProps} />);

    const nameField = screen.getByLabelText(/name/i);
    await user.click(nameField);
    await user.type(nameField, 'a');
    await user.clear(nameField);
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });
});
