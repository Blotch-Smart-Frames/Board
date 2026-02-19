import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Sprint } from '../../types/board';

// Mock date picker modules used transitively by SprintDialog / SprintManagement
vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: Date | null;
    onChange: (date: Date | null) => void;
  }) => (
    <input
      aria-label={label}
      value={value?.toISOString?.() ?? ''}
      onChange={(e) =>
        onChange(e.target.value ? new Date(e.target.value) : null)
      }
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

let mockSprints: Sprint[] = [];
let mockIsLoading = false;

const mockCreateSprint = vi.fn();
const mockUpdateSprint = vi.fn();
const mockDeleteSprint = vi.fn();
const mockCanDeleteSprint = vi.fn();
const mockCalculateNextSprintDates = vi.fn();
const mockUpdateSprintConfig = vi.fn();

vi.mock('../../hooks/useSprintsQuery', () => ({
  useSprintsQuery: () => ({
    sprints: mockSprints,
    isLoading: mockIsLoading,
    createSprint: mockCreateSprint,
    updateSprint: mockUpdateSprint,
    deleteSprint: mockDeleteSprint,
    canDeleteSprint: mockCanDeleteSprint,
    calculateNextSprintDates: mockCalculateNextSprintDates,
    updateSprintConfig: mockUpdateSprintConfig,
  }),
}));

import { SprintPicker } from './SprintPicker';

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

describe('SprintPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSprints = [];
    mockIsLoading = false;
  });

  it('shows loading spinner when loading', () => {
    mockIsLoading = true;
    const { container } = render(
      <SprintPicker
        boardId="board-1"
        selectedSprintId={null}
        onChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(
      container.querySelector('.MuiCircularProgress-root'),
    ).toBeInTheDocument();
  });

  it('renders Sprint label', () => {
    render(
      <SprintPicker
        boardId="board-1"
        selectedSprintId={null}
        onChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Sprint')).toBeInTheDocument();
  });

  it('renders Manage button', () => {
    render(
      <SprintPicker
        boardId="board-1"
        selectedSprintId={null}
        onChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole('button', { name: /manage/i })).toBeInTheDocument();
  });

  it('renders Create sprint button', () => {
    render(
      <SprintPicker
        boardId="board-1"
        selectedSprintId={null}
        onChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(
      screen.getByRole('button', { name: /create sprint/i }),
    ).toBeInTheDocument();
  });

  it('shows No sprint (Backlog) option in select', async () => {
    const user = userEvent.setup();
    mockSprints = [createMockSprint()];

    render(
      <SprintPicker
        boardId="board-1"
        selectedSprintId={null}
        onChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    // Open the select dropdown
    const select = screen.getByRole('combobox');
    await user.click(select);

    // Both the selected display and dropdown option contain this text
    const matches = screen.getAllByText(/no sprint.*backlog/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
