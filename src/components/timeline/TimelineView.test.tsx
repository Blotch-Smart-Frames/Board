import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimelineView } from './TimelineView';
import type { Task, List, Label, Sprint } from '../../types/board';

vi.mock('dnd-timeline', () => ({
  TimelineContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useTimelineContext: () => ({
    setTimelineRef: vi.fn(),
    style: {},
    range: { start: Date.now(), end: Date.now() + 86400000 },
    valueToPixels: vi.fn(() => 80),
  }),
  useItem: () => ({
    setNodeRef: vi.fn(),
    attributes: {},
    listeners: {},
    itemStyle: {},
    itemContentStyle: {},
  }),
  useRow: () => ({
    setNodeRef: vi.fn(),
    rowWrapperStyle: {},
    rowStyle: {},
  }),
}));

const createMockList = (overrides: Partial<List> = {}): List =>
  ({
    id: 'list-1',
    title: 'To Do',
    order: 'a0',
    ...overrides,
  }) as List;

const createMockTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 'task-1',
    listId: 'list-1',
    title: 'Test Task',
    order: 'a0',
    calendarSyncEnabled: false,
    createdBy: 'user-1',
    ...overrides,
  }) as Task;

describe('TimelineView', () => {
  const defaultProps = {
    tasks: [] as Task[],
    lists: [] as List[],
    labels: [] as Label[],
    sprints: [] as Sprint[],
    onUpdateTask: vi.fn(),
    onEditTask: vi.fn(),
    moveTask: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no lists', () => {
    render(<TimelineView {...defaultProps} />);

    expect(
      screen.getByText(
        'No lists in this board. Add a list to start using the timeline.',
      ),
    ).toBeInTheDocument();
  });

  it('shows empty state when lists exist but no tasks', () => {
    render(
      <TimelineView
        {...defaultProps}
        lists={[createMockList()]}
      />,
    );

    expect(
      screen.getByText('No tasks in this board yet.'),
    ).toBeInTheDocument();
  });

  it('shows hidden count alert when tasks lack dates', () => {
    const tasks = [
      createMockTask({ id: 't1' }), // no startDate or dueDate
    ];

    render(
      <TimelineView
        {...defaultProps}
        tasks={tasks}
        lists={[createMockList()]}
      />,
    );

    expect(screen.getByText(/1 task hidden/)).toBeInTheDocument();
  });

  it('shows message to set dates when all tasks hidden', () => {
    const tasks = [
      createMockTask({ id: 't1' }),
      createMockTask({ id: 't2' }),
    ];

    render(
      <TimelineView
        {...defaultProps}
        tasks={tasks}
        lists={[createMockList()]}
      />,
    );

    expect(
      screen.getByText(
        'Set start and due dates on tasks to see them in the timeline.',
      ),
    ).toBeInTheDocument();
  });

  it('renders timeline when tasks have dates', () => {
    const tasks = [
      createMockTask({
        id: 't1',
        startDate: { toMillis: () => Date.now() } as any,
        dueDate: { toMillis: () => Date.now() + 86400000 } as any,
      }),
    ];

    render(
      <TimelineView
        {...defaultProps}
        tasks={tasks}
        lists={[createMockList()]}
      />,
    );

    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });
});
