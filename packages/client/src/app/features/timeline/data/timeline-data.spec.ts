import type { Timestamp } from 'firebase/firestore';
import { computeTimelineRows, computeTimelineItems, computeVisibleDates } from './timeline-data';
import type { List, Task } from '../../../shared/types/board';

function ts(date: Date): Timestamp {
  return { toDate: () => date, toMillis: () => date.getTime() } as Timestamp;
}

function fakeList(overrides: Partial<List> = {}): List {
  return {
    id: 'l1',
    title: 'List',
    order: 'a0',
    createdAt: {} as Timestamp,
    ...overrides,
  };
}

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    listId: 'list-1',
    title: 'Task',
    order: 'a0',
    calendarSyncEnabled: false,
    archive: false,
    createdBy: 'u1',
    createdAt: {} as Timestamp,
    updatedAt: {} as Timestamp,
    ...overrides,
  };
}

describe('computeTimelineRows', () => {
  it('sorts scrambled lists by fractional-index order and drops other fields', () => {
    const listA = fakeList({ id: 'lA', title: 'List A', order: 'a2' });
    const listB = fakeList({ id: 'lB', title: 'List B', order: 'a0' });
    const listC = fakeList({ id: 'lC', title: 'List C', order: 'a1' });

    const rows = computeTimelineRows([listA, listB, listC]);

    expect(rows).toEqual([
      { id: 'lB', title: 'List B' },
      { id: 'lC', title: 'List C' },
      { id: 'lA', title: 'List A' },
    ]);
  });
});

describe('computeTimelineItems', () => {
  it('includes only tasks with both a start and due date, and counts the rest as hidden', () => {
    const startDate = ts(new Date(2026, 0, 1));
    const dueDate = ts(new Date(2026, 0, 5));

    const withBoth = fakeTask({ id: 't1', listId: 'list-1', startDate, dueDate });
    const missingStart = fakeTask({ id: 't2', listId: 'list-1', dueDate });
    const missingDue = fakeTask({ id: 't3', listId: 'list-1', startDate });
    const missingBoth = fakeTask({ id: 't4', listId: 'list-1' });

    const { items, hiddenCount } = computeTimelineItems([
      withBoth,
      missingStart,
      missingDue,
      missingBoth,
    ]);

    expect(items).toEqual([
      {
        id: 't1',
        rowId: 'list-1',
        span: { start: startDate.toMillis(), end: dueDate.toMillis() },
        task: withBoth,
      },
    ]);
    expect(hiddenCount).toBe(3);
  });

  it('returns no items and zero hidden count for an empty task list', () => {
    expect(computeTimelineItems([])).toEqual({ items: [], hiddenCount: 0 });
  });
});

describe('computeVisibleDates', () => {
  it('returns every day in the range when dimensions are not ready (fallback path)', () => {
    const rangeStart = new Date(2026, 0, 1).getTime();
    const rangeEnd = new Date(2026, 0, 5).getTime();

    const dates = computeVisibleDates({
      rangeStart,
      rangeEnd,
      scrollLeft: 0,
      viewportWidth: 0,
      dayWidthPixels: 0,
    });

    expect(dates).toHaveLength(5);
    expect(dates.map((d) => d.getDate())).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns a contiguous virtualized window around the scrolled position, padded by the buffer', () => {
    const rangeStart = new Date(2026, 0, 1).getTime();
    const rangeEnd = new Date(2026, 0, 30).getTime(); // 30 days total (Jan 1 - Jan 30)

    const dates = computeVisibleDates({
      rangeStart,
      rangeEnd,
      scrollLeft: 500,
      viewportWidth: 300,
      dayWidthPixels: 100,
    });

    // firstVisibleDayIndex = floor(500/100) = 5
    // visibleDaysCount = ceil(300/100) + 1 = 4
    // startIndex = max(0, 5 - 3) = 2 -> Jan 3
    // endIndex = min(29, 5 + 4 + 3) = 12 -> Jan 13
    expect(dates).toHaveLength(11);
    expect(dates[0].getDate()).toBe(3);
    expect(dates[dates.length - 1].getDate()).toBe(13);
    expect(dates.some((d) => d.getDate() === 1)).toBe(false);
    expect(dates.some((d) => d.getDate() === 30)).toBe(false);
  });

  it('shrinks the window when a smaller custom buffer is provided', () => {
    const rangeStart = new Date(2026, 0, 1).getTime();
    const rangeEnd = new Date(2026, 0, 30).getTime();

    const dates = computeVisibleDates({
      rangeStart,
      rangeEnd,
      scrollLeft: 500,
      viewportWidth: 300,
      dayWidthPixels: 100,
      buffer: 0,
    });

    // firstVisibleDayIndex = floor(500/100) = 5
    // visibleDaysCount = ceil(300/100) + 1 = 4
    // startIndex = max(0, 5 - 0) = 5 -> Jan 6
    // endIndex = min(29, 5 + 4 + 0) = 9 -> Jan 10
    expect(dates).toHaveLength(5);
    expect(dates[0].getDate()).toBe(6);
    expect(dates[dates.length - 1].getDate()).toBe(10);
  });

  it('returns an empty array when the range end is before the range start', () => {
    const rangeStart = new Date(2026, 0, 10).getTime();
    const rangeEnd = new Date(2026, 0, 5).getTime();

    const dates = computeVisibleDates({
      rangeStart,
      rangeEnd,
      scrollLeft: 0,
      viewportWidth: 0,
      dayWidthPixels: 0,
    });

    expect(dates).toEqual([]);
  });
});
