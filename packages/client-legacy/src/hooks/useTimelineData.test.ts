import { describe, it, expect } from 'vitest';
import { useTimelineData } from './useTimelineData';
import type { Timestamp } from 'firebase/firestore';
import type { Task, List } from '../types/board';

// useTimelineData is a pure function (no hooks), so we can test it directly
describe('useTimelineData', () => {
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

  it('returns empty items and rows for empty inputs', () => {
    const result = useTimelineData([], []);

    expect(result.items).toEqual([]);
    expect(result.rows).toEqual([]);
    expect(result.hiddenCount).toBe(0);
  });

  it('creates rows from lists sorted by order', () => {
    const lists = [
      createMockList({ id: 'list-2', title: 'Done', order: 'a2' }),
      createMockList({ id: 'list-1', title: 'To Do', order: 'a0' }),
    ];

    const result = useTimelineData([], lists);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].title).toBe('To Do');
    expect(result.rows[1].title).toBe('Done');
  });

  it('filters tasks to only those with both startDate and dueDate', () => {
    const startDate = { toMillis: () => 1000 };
    const dueDate = { toMillis: () => 2000 };

    const tasks = [
      createMockTask({
        id: 't1',
        startDate: startDate as unknown as Timestamp,
        dueDate: dueDate as unknown as Timestamp,
      }),
      createMockTask({
        id: 't2',
        startDate: undefined,
        dueDate: dueDate as unknown as Timestamp,
      }),
      createMockTask({
        id: 't3',
        startDate: startDate as unknown as Timestamp,
        dueDate: undefined,
      }),
      createMockTask({ id: 't4', startDate: undefined, dueDate: undefined }),
    ];

    const lists = [createMockList()];
    const result = useTimelineData(tasks, lists);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('t1');
    expect(result.hiddenCount).toBe(3);
  });

  it('maps task dates to item span', () => {
    const tasks = [
      createMockTask({
        id: 't1',
        startDate: { toMillis: () => 1000 } as unknown as Timestamp,
        dueDate: { toMillis: () => 5000 } as unknown as Timestamp,
      }),
    ];

    const lists = [createMockList()];
    const result = useTimelineData(tasks, lists);

    expect(result.items[0].span).toEqual({ start: 1000, end: 5000 });
  });

  it('sets rowId to task listId', () => {
    const tasks = [
      createMockTask({
        id: 't1',
        listId: 'list-2',
        startDate: { toMillis: () => 1000 } as unknown as Timestamp,
        dueDate: { toMillis: () => 5000 } as unknown as Timestamp,
      }),
    ];

    const lists = [createMockList({ id: 'list-2' })];
    const result = useTimelineData(tasks, lists);

    expect(result.items[0].rowId).toBe('list-2');
  });
});
