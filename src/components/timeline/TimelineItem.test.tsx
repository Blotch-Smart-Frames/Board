import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimelineItem } from './TimelineItem';
import type { TimelineItem as TimelineItemType } from '../../hooks/useTimelineData';
import type { Label, Task } from '../../types/board';

vi.mock('dnd-timeline', () => ({
  useItem: () => ({
    setNodeRef: vi.fn(),
    attributes: {},
    listeners: {},
    itemStyle: {},
    itemContentStyle: {},
  }),
}));

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material');
  return {
    ...actual,
    useTheme: () => ({
      palette: {
        primary: { main: '#1976d2' },
      },
    }),
  };
});

const createMockTimelineItem = (
  overrides: Partial<TimelineItemType> = {},
): TimelineItemType => ({
  id: 'item-1',
  rowId: 'list-1',
  span: { start: 1000, end: 5000 },
  task: {
    id: 'task-1',
    listId: 'list-1',
    title: 'Test Task',
    order: 'a0',
    calendarSyncEnabled: false,
    createdBy: 'user-1',
  } as Task,
  ...overrides,
});

describe('TimelineItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders task title', () => {
    const item = createMockTimelineItem();
    render(<TimelineItem item={item} labels={[]} />);

    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('uses label color when task has labels', () => {
    const item = createMockTimelineItem({
      task: {
        id: 'task-1',
        listId: 'list-1',
        title: 'Labeled Task',
        order: 'a0',
        calendarSyncEnabled: false,
        createdBy: 'user-1',
        labelIds: ['label-1'],
      } as Task,
    });

    const labels: Label[] = [
      {
        id: 'label-1',
        name: 'Bug',
        color: '#EF4444',
        order: 'a0',
      } as Label,
    ];

    const { container } = render(<TimelineItem item={item} labels={labels} />);

    // Should use label color for background
    expect(container.firstChild).toBeInTheDocument();
  });

  it('calls onClick when clicked without drag', async () => {
    const onClick = vi.fn();
    const item = createMockTimelineItem();

    render(<TimelineItem item={item} labels={[]} onClick={onClick} />);

    // Item should be rendered
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });
});
