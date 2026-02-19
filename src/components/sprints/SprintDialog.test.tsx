import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Sprint } from '../../types/board';

// Mock the date picker to avoid ESM resolution issues
vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({
    label,
    value,
    onChange,
    slotProps,
  }: {
    label: string;
    value: Date | null;
    onChange: (date: Date | null) => void;
    slotProps?: { textField?: Record<string, unknown> };
  }) => (
    <input
      aria-label={label}
      value={value?.toISOString?.() ?? ''}
      onChange={(e) =>
        onChange(e.target.value ? new Date(e.target.value) : null)
      }
      {...(slotProps?.textField ?? {})}
    />
  ),
}));

vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: class {},
}));

const mockCreateSprint = vi.fn();
const mockUpdateSprint = vi.fn();
const mockCalculateNextSprintDates = vi.fn();

vi.mock('../../hooks/useSprintsQuery', () => ({
  useSprintsQuery: () => ({
    createSprint: mockCreateSprint,
    updateSprint: mockUpdateSprint,
    calculateNextSprintDates: mockCalculateNextSprintDates,
  }),
}));

import { SprintDialog } from './SprintDialog';

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

describe('SprintDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<SprintDialog boardId="board-1" open={false} onClose={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByText('Create Sprint')).not.toBeInTheDocument();
  });

  it('shows Edit Sprint title when editing', () => {
    const sprint = createMockSprint();
    render(
      <SprintDialog
        boardId="board-1"
        open={true}
        sprint={sprint}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Edit Sprint')).toBeInTheDocument();
  });

  it('shows sprint name field with existing value when editing', () => {
    const sprint = createMockSprint({ name: 'Sprint 1' });
    render(
      <SprintDialog
        boardId="board-1"
        open={true}
        sprint={sprint}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    const nameInput = screen.getByLabelText(/sprint name/i);
    expect(nameInput).toHaveValue('Sprint 1');
  });

  it('calls onClose when Cancel clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const sprint = createMockSprint();

    render(
      <SprintDialog
        boardId="board-1"
        open={true}
        sprint={sprint}
        onClose={onClose}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('shows Save button when editing', () => {
    const sprint = createMockSprint();
    render(
      <SprintDialog
        boardId="board-1"
        open={true}
        sprint={sprint}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
