import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Timestamp } from 'firebase/firestore';
import { LabelPicker } from './LabelPicker';
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
const mockInitializeDefaultLabels = vi.fn().mockResolvedValue(undefined);
let mockIsLoading = false;
let mockLabelsData = mockLabels;

vi.mock('../../hooks/useLabelsQuery', () => ({
  useLabelsQuery: () => ({
    labels: mockLabelsData,
    isLoading: mockIsLoading,
    createLabel: mockCreateLabel,
    updateLabel: vi.fn(),
    deleteLabel: vi.fn(),
    initializeDefaultLabels: mockInitializeDefaultLabels,
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

describe('LabelPicker', () => {
  const defaultProps = {
    boardId: 'board-1',
    selectedLabelIds: [] as string[],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading = false;
    mockLabelsData = mockLabels;
  });

  it('renders all labels sorted by order', () => {
    render(<LabelPicker {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
  });

  it('renders labels header and manage button', () => {
    render(<LabelPicker {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Labels')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manage/i })).toBeInTheDocument();
  });

  it('shows loading spinner when isLoading is true', () => {
    mockIsLoading = true;

    render(<LabelPicker {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders checkboxes for each label', () => {
    render(<LabelPicker {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(mockLabels.length);
  });

  it('checks selected labels', () => {
    render(<LabelPicker {...defaultProps} selectedLabelIds={['label-1']} />, {
      wrapper: createWrapper(),
    });

    const checkboxes = screen.getAllByRole('checkbox');
    // label-2 (Feature, order 0) comes first, label-1 (Bug, order 1) second
    expect(checkboxes[0]).not.toBeChecked(); // Feature
    expect(checkboxes[1]).toBeChecked(); // Bug
  });

  it('calls onChange to add label when an unselected label is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LabelPicker {...defaultProps} onChange={onChange} />, {
      wrapper: createWrapper(),
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]); // Click Feature (first sorted)

    expect(onChange).toHaveBeenCalledWith(['label-2']);
  });

  it('calls onChange to remove label when a selected label is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LabelPicker
        {...defaultProps}
        selectedLabelIds={['label-1', 'label-2']}
        onChange={onChange}
      />,
      { wrapper: createWrapper() },
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]); // Click Bug (second sorted, label-1)

    expect(onChange).toHaveBeenCalledWith(['label-2']);
  });

  it('renders create label button', () => {
    render(<LabelPicker {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    expect(
      screen.getByRole('button', { name: /create label/i }),
    ).toBeInTheDocument();
  });

  it('opens label editor when create label is clicked', async () => {
    const user = userEvent.setup();
    render(<LabelPicker {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /create label/i }));

    expect(screen.getByText('Create Label')).toBeInTheDocument();
  });

  it('opens management dialog when manage button is clicked', async () => {
    const user = userEvent.setup();
    render(<LabelPicker {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('button', { name: /manage/i }));

    expect(screen.getByText('Manage Labels')).toBeInTheDocument();
  });

  it('initializes default labels when none exist and not loading', () => {
    mockLabelsData = [];

    render(<LabelPicker {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    expect(mockInitializeDefaultLabels).toHaveBeenCalled();
  });

  it('does not initialize default labels when still loading', () => {
    mockIsLoading = true;
    mockLabelsData = [];

    render(<LabelPicker {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    expect(mockInitializeDefaultLabels).not.toHaveBeenCalled();
  });

  it('does not initialize default labels when labels already exist', () => {
    render(<LabelPicker {...defaultProps} />, {
      wrapper: createWrapper(),
    });

    expect(mockInitializeDefaultLabels).not.toHaveBeenCalled();
  });
});
