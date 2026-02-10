import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Timestamp } from 'firebase/firestore';
import { LabelManagement } from './LabelManagement';
import type { Label } from '../../types/board';

const mockTimestamp = {
  toDate: () => new Date(),
} as Timestamp;

const mockLabels: Label[] = [
  {
    id: 'label-1',
    name: 'Bug',
    color: '#EF4444',
    emoji: '🐛',
    order: 1,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
  {
    id: 'label-2',
    name: 'Feature',
    color: '#3B82F6',
    emoji: '✨',
    order: 0,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
];

const mockCreateLabel = vi.fn().mockResolvedValue(undefined);
const mockUpdateLabel = vi.fn().mockResolvedValue(undefined);
const mockDeleteLabel = vi.fn().mockResolvedValue(undefined);

vi.mock('../../hooks/useLabelsQuery', () => ({
  useLabelsQuery: () => ({
    labels: mockLabels,
    isLoading: false,
    createLabel: mockCreateLabel,
    updateLabel: mockUpdateLabel,
    deleteLabel: mockDeleteLabel,
    initializeDefaultLabels: vi.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('LabelManagement', () => {
  const defaultProps = {
    boardId: 'board-1',
    open: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog with title', () => {
    render(<LabelManagement {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Manage Labels')).toBeInTheDocument();
  });

  it('renders all labels sorted by order', () => {
    render(<LabelManagement {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    const listItems = screen.getAllByRole('button', { name: /feature|bug/i });
    // Feature (order 0) should appear before Bug (order 1)
    expect(listItems[0]).toHaveTextContent('Feature');
    expect(listItems[1]).toHaveTextContent('Bug');
  });

  it('renders create new label button', () => {
    render(<LabelManagement {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.getByRole('button', { name: /create new label/i }),
    ).toBeInTheDocument();
  });

  it('calls onClose when close icon is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<LabelManagement {...defaultProps} onClose={onClose} />, {
      wrapper: createWrapper(),
    });

    const closeButton = screen
      .getAllByRole('button')
      .find((btn) => btn.querySelector('[data-testid="CloseIcon"]') !== null);

    await user.click(closeButton!);

    expect(onClose).toHaveBeenCalled();
  });

  it('opens editor in create mode when create button is clicked', async () => {
    const user = userEvent.setup();
    render(<LabelManagement {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /create new label/i }));

    expect(screen.getByText('Create Label')).toBeInTheDocument();
  });

  it('opens editor in edit mode when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<LabelManagement {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    const editButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.querySelector('[data-testid="EditIcon"]') !== null);

    await user.click(editButtons[0]);

    expect(screen.getByText('Edit Label')).toBeInTheDocument();
  });

  it('calls deleteLabel when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<LabelManagement {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    const deleteButtons = screen
      .getAllByRole('button')
      .filter(
        (btn) => btn.querySelector('[data-testid="DeleteIcon"]') !== null,
      );

    await user.click(deleteButtons[0]);

    // First label sorted by order is "Feature" (label-2)
    expect(mockDeleteLabel).toHaveBeenCalledWith('label-2');
  });

  it('renders nothing visible when open is false', () => {
    const { container } = render(
      <LabelManagement {...defaultProps} open={false} />,
      { wrapper: createWrapper() },
    );

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens editor when clicking on a label row', async () => {
    const user = userEvent.setup();
    render(<LabelManagement {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    // Click on a label's list item button
    const labelButtons = screen.getAllByRole('button', {
      name: /feature|bug/i,
    });
    await user.click(labelButtons[0]);

    expect(screen.getByText('Edit Label')).toBeInTheDocument();
  });
});
