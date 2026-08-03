import { addDays, differenceInDays, startOfDay } from 'date-fns';
import { compareOrder } from '../../../shared/utils/ordering';
import type { List, Task } from '../../../shared/types/board';

export type TimelineRow = { id: string; title: string };
export type TimelineSpan = { start: number; end: number };
export type TimelineItemData = { id: string; rowId: string; span: TimelineSpan; task: Task };

export function computeTimelineRows(lists: List[]): TimelineRow[] {
  return [...lists]
    .sort((a, b) => compareOrder(a.order, b.order))
    .map((list) => ({ id: list.id, title: list.title }));
}

/** Only tasks with both a start and due date can be placed on the timeline. */
export function computeTimelineItems(tasks: Task[]): { items: TimelineItemData[]; hiddenCount: number } {
  const withDates = tasks.filter((task) => task.startDate && task.dueDate);
  const items = withDates.map((task) => ({
    id: task.id,
    rowId: task.listId,
    span: { start: task.startDate!.toMillis(), end: task.dueDate!.toMillis() },
    task,
  }));
  return { items, hiddenCount: tasks.length - withDates.length };
}

export type VisibleDatesOptions = {
  rangeStart: number;
  rangeEnd: number;
  scrollLeft: number;
  viewportWidth: number;
  dayWidthPixels: number;
  buffer?: number;
};

/** Virtualizes the header's day cells to the scrolled-into-view window (plus a buffer). */
export function computeVisibleDates(opts: VisibleDatesOptions): Date[] {
  const { rangeStart, rangeEnd, scrollLeft, viewportWidth, dayWidthPixels, buffer = 3 } = opts;
  const startDate = startOfDay(new Date(rangeStart));
  const endDate = startOfDay(new Date(rangeEnd));
  const totalDays = differenceInDays(endDate, startDate) + 1;
  if (totalDays <= 0) return [];

  if (dayWidthPixels <= 0 || viewportWidth <= 0) {
    return Array.from({ length: totalDays }, (_, i) => addDays(startDate, i));
  }

  const firstVisibleDayIndex = Math.floor(scrollLeft / dayWidthPixels);
  const visibleDaysCount = Math.ceil(viewportWidth / dayWidthPixels) + 1;
  const startIndex = Math.max(0, firstVisibleDayIndex - buffer);
  const endIndex = Math.min(totalDays - 1, firstVisibleDayIndex + visibleDaysCount + buffer);

  const days: Date[] = [];
  for (let i = startIndex; i <= endIndex; i++) days.push(addDays(startDate, i));
  return days;
}
