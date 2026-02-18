import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimelineContent } from './TimelineContent';
import type { TimelineItem as TimelineItemType } from '../../hooks/useTimelineData';
import type { Task, Label, Sprint } from '../../types/board';

vi.mock('dnd-timeline', () => ({
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

const createMockItem = (
  overrides: Partial<TimelineItemType> = {},
): TimelineItemType => ({
  id: 'item-1',
  rowId: 'list-1',
  span: { start: Date.now(), end: Date.now() + 86400000 },
  task: createMockTask(),
  ...overrides,
});

describe('TimelineContent', () => {
  const defaultProps = {
    rows: [{ id: 'list-1', title: 'To Do' }],
    items: [] as TimelineItemType[],
    labels: [] as Label[],
    sprints: [] as Sprint[],
    remountKeys: new Map<string, number>(),
    onEditTask: vi.fn(),
    onExpandPast: vi.fn(),
    onExpandFuture: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Lists" sidebar header', () => {
    render(<TimelineContent {...defaultProps} />);

    expect(screen.getByText('Lists')).toBeInTheDocument();
  });

  it('renders row labels in the sidebar', () => {
    const rows = [
      { id: 'list-1', title: 'To Do' },
      { id: 'list-2', title: 'In Progress' },
      { id: 'list-3', title: 'Done' },
    ];

    render(<TimelineContent {...defaultProps} rows={rows} />);

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('renders timeline items in their respective rows', () => {
    const items = [
      createMockItem({
        id: 'item-1',
        rowId: 'list-1',
        task: createMockTask({ id: 'task-1', title: 'First Task' }),
      }),
      createMockItem({
        id: 'item-2',
        rowId: 'list-2',
        task: createMockTask({ id: 'task-2', title: 'Second Task', listId: 'list-2' }),
      }),
    ];

    const rows = [
      { id: 'list-1', title: 'To Do' },
      { id: 'list-2', title: 'In Progress' },
    ];

    render(
      <TimelineContent {...defaultProps} rows={rows} items={items} />,
    );

    expect(screen.getByText('First Task')).toBeInTheDocument();
    expect(screen.getByText('Second Task')).toBeInTheDocument();
  });

  it('renders no items when items array is empty', () => {
    render(<TimelineContent {...defaultProps} />);

    expect(screen.queryByText('Test Task')).not.toBeInTheDocument();
  });

  it('calls onEditTask when a timeline item is clicked', async () => {
    const user = userEvent.setup();
    const onEditTask = vi.fn();
    const task = createMockTask({ id: 'task-1', title: 'Clickable Task' });
    const items = [createMockItem({ id: 'item-1', rowId: 'list-1', task })];

    render(
      <TimelineContent {...defaultProps} items={items} onEditTask={onEditTask} />,
    );

    await user.click(screen.getByText('Clickable Task'));

    expect(onEditTask).toHaveBeenCalledWith(task);
  });

  it('renders multiple items in the same row', () => {
    const items = [
      createMockItem({
        id: 'item-1',
        rowId: 'list-1',
        task: createMockTask({ id: 'task-1', title: 'Task A' }),
      }),
      createMockItem({
        id: 'item-2',
        rowId: 'list-1',
        task: createMockTask({ id: 'task-2', title: 'Task B' }),
      }),
    ];

    render(<TimelineContent {...defaultProps} items={items} />);

    expect(screen.getByText('Task A')).toBeInTheDocument();
    expect(screen.getByText('Task B')).toBeInTheDocument();
  });

  it('does not render items for rows that do not exist', () => {
    const items = [
      createMockItem({
        id: 'item-1',
        rowId: 'nonexistent-list',
        task: createMockTask({ id: 'task-1', title: 'Orphan Task' }),
      }),
    ];

    render(<TimelineContent {...defaultProps} items={items} />);

    expect(screen.queryByText('Orphan Task')).not.toBeInTheDocument();
  });

  it('uses remountKeys for item key generation', () => {
    const remountKeys = new Map([['item-1', 3]]);
    const items = [
      createMockItem({
        id: 'item-1',
        rowId: 'list-1',
        task: createMockTask({ id: 'task-1', title: 'Remounted Task' }),
      }),
    ];

    render(
      <TimelineContent {...defaultProps} items={items} remountKeys={remountKeys} />,
    );

    expect(screen.getByText('Remounted Task')).toBeInTheDocument();
  });
});
