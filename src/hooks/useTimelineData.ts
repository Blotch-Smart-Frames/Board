import type { Task, List } from '../types/board';
import { compareOrder } from '../utils/ordering';

export type TimelineItem = {
  id: string;
  rowId: string;
  span: {
    start: number;
    end: number;
  };
  task: Task;
};

export type TimelineRow = {
  id: string;
  title: string;
};

type UseTimelineDataResult = {
  items: TimelineItem[];
  rows: TimelineRow[];
  hiddenCount: number;
};

export function useTimelineData(
  tasks: Task[],
  lists: List[],
): UseTimelineDataResult {
  const sortedLists = [...lists].sort((a, b) => compareOrder(a.order, b.order));

  const rows: TimelineRow[] = sortedLists.map((list) => ({
    id: list.id,
    title: list.title,
  }));

  const tasksWithDates = tasks.filter(
    (task) => task.startDate && task.dueDate,
  );
  const hiddenCount = tasks.length - tasksWithDates.length;

  const items: TimelineItem[] = tasksWithDates.map((task) => ({
    id: task.id,
    rowId: task.listId,
    span: {
      start: task.startDate!.toMillis(),
      end: task.dueDate!.toMillis(),
    },
    task,
  }));

  return { items, rows, hiddenCount };
}
