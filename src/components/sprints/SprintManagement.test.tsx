import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Sprint, Board } from '../../types/board';

// Mock date picker modules used by SprintDialog (imported transitively)
vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({ label, value, onChange }: any) => (
    <input
      aria-label={label}
      value={value?.toISOString?.() ?? ''}
      onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
    />
  ),
}));

vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: class {},
}));

const mockDeleteSprint = vi.fn();
const mockCanDeleteSprint = vi.fn();
const mockUpdateSprintConfig = vi.fn();
const mockCreateSprint = vi.fn();
const mockUpdateSprint = vi.fn();
const mockCalculateNextSprintDates = vi.fn();

let mockSprints: Sprint[] = [];

vi.mock('../../hooks/useSprintsQuery', () => ({
  useSprintsQuery: () => ({
    sprints: mockSprints,
    isLoading: false,
    deleteSprint: mockDeleteSprint,
    canDeleteSprint: mockCanDeleteSprint,
    updateSprintConfig: mockUpdateSprintConfig,
    createSprint: mockCreateSprint,
    updateSprint: mockUpdateSprint,
    calculateNextSprintDates: mockCalculateNextSprintDates,
  }),
}));

import { SprintManagement } from './SprintManagement';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const createMockSprint = (overrides: Partial<Sprint> = {}): Sprint =>
  ({
    id: 'sprint-1',
    name: 'Sprint 1',
    startDate: { toDate: () => new Date('2024-01-01') },
    endDate: { toDate: () => new Date('2024-01-14') },
    order: 'a0',
    ...overrides,
  }) as Sprint;

const createMockBoard = (overrides: Partial<Board> = {}): Board =>
  ({
    id: 'board-1',
    title: 'Test',
    ownerId: 'user-1',
    collaborators: [],
    sprintConfig: { durationDays: 14 },
    ...overrides,
  }) as Board;

describe('SprintManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSprints = [];
  });

  it('renders nothing when closed', () => {
    render(
      <SprintManagement
        boardId="board-1"
        open={false}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByText('Sprint Management')).not.toBeInTheDocument();
  });

  it('shows Sprint Management title when open', () => {
    render(
      <SprintManagement boardId="board-1" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Sprint Management')).toBeInTheDocument();
  });

  it('shows empty state when no sprints', () => {
    render(
      <SprintManagement boardId="board-1" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('No sprints created yet')).toBeInTheDocument();
  });

  it('renders sprint list', () => {
    mockSprints = [
      createMockSprint({ id: 's1', name: 'Sprint 1' }),
      createMockSprint({ id: 's2', name: 'Sprint 2', order: 'a1' }),
    ];

    render(
      <SprintManagement boardId="board-1" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    expect(screen.getByText('Sprint 2')).toBeInTheDocument();
  });

  it('shows Create Sprint button', () => {
    render(
      <SprintManagement boardId="board-1" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    expect(
      screen.getByRole('button', { name: /create sprint/i }),
    ).toBeInTheDocument();
  });

  it('shows sprint duration config', () => {
    render(
      <SprintManagement
        boardId="board-1"
        board={createMockBoard()}
        open={true}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Default Sprint Duration')).toBeInTheDocument();
  });

  it('calls onClose when Close clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <SprintManagement boardId="board-1" open={true} onClose={onClose} />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('shows error when sprint cannot be deleted', async () => {
    const user = userEvent.setup();
    mockSprints = [createMockSprint()];
    mockCanDeleteSprint.mockResolvedValue({ canDelete: false, taskCount: 3 });

    render(
      <SprintManagement boardId="board-1" open={true} onClose={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    const deleteButtons = screen.getAllByTestId('DeleteIcon');
    await user.click(deleteButtons[0].closest('button')!);

    expect(
      await screen.findByText(/cannot delete.*3 tasks/i),
    ).toBeInTheDocument();
  });
});
