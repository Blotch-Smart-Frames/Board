import { useState } from 'react';
import type {
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queries/queryKeys';
import type { Task, List } from '../types/board';
import { getOrderAtIndex, compareOrder } from '../utils/ordering';

type UseDragAndDropOptions = {
  boardId: string | null;
  lists: List[];
  tasks: Task[];
  onMoveTask?: (
    taskId: string,
    newListId: string,
    newOrder: string,
  ) => Promise<void>;
  onReorderLists?: (listId: string, newOrder: string) => Promise<void>;
};

export const useDragAndDrop = (options: UseDragAndDropOptions) => {
  const { boardId, lists, tasks, onMoveTask, onReorderLists } = options;
  const queryClient = useQueryClient();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'task' | 'list' | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const getActiveTask = (): Task | undefined => {
    if (activeType !== 'task' || !activeId) return undefined;
    return tasks.find((t) => t.id === activeId);
  };

  const getActiveList = (): List | undefined => {
    if (activeType !== 'list' || !activeId) return undefined;
    return lists.find((l) => l.id === activeId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const type = active.data.current?.type as 'task' | 'list';

    setActiveId(active.id as string);
    setActiveType(type);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveType(null);
    setOverId(null);

    if (!over || !boardId) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    if (activeIdStr === overIdStr) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === 'task') {
      const activeTask = tasks.find((t) => t.id === activeIdStr);
      if (!activeTask) return;

      let targetListId: string;
      let targetIndex: number;

      if (overData?.type === 'task') {
        // Dropping on another task
        const overTask = tasks.find((t) => t.id === overIdStr);
        if (!overTask) return;

        targetListId = overTask.listId;

        // Get original indices from sortable data
        const activeSortableIndex = activeData?.sortable?.index ?? -1;
        const overSortableIndex = overData?.sortable?.index ?? -1;

        // Check if moving within the same list
        const sameList = activeTask.listId === targetListId;

        const listTasks = tasks
          .filter((t) => t.listId === targetListId && t.id !== activeIdStr)
          .sort((a, b) => compareOrder(a.order, b.order));

        const overIndex = listTasks.findIndex((t) => t.id === overIdStr);

        // When moving down within the same list, we need to place AFTER the over item
        // When moving up or across lists, we place BEFORE the over item
        const movingDown = sameList && activeSortableIndex < overSortableIndex;

        targetIndex =
          overIndex >= 0
            ? movingDown
              ? overIndex + 1
              : overIndex
            : listTasks.length;
      } else if (overData?.type === 'list') {
        // Dropping on an empty list
        targetListId = overIdStr;
        targetIndex = 0;
      } else {
        return;
      }

      // Calculate the fractional order key
      const destTasks = tasks
        .filter((t) => t.listId === targetListId && t.id !== activeIdStr)
        .sort((a, b) => compareOrder(a.order, b.order));
      const newOrder = getOrderAtIndex(destTasks, targetIndex);

      // Optimistic update via React Query cache
      const previousTasks = queryClient.getQueryData<Task[]>(
        queryKeys.boards.tasks(boardId),
      );

      if (previousTasks) {
        const updatedTasks = previousTasks.map((task) => {
          if (task.id === activeIdStr) {
            return { ...task, listId: targetListId, order: newOrder };
          }
          return task;
        });
        queryClient.setQueryData(queryKeys.boards.tasks(boardId), updatedTasks);
      }

      // Sync with server
      if (onMoveTask) {
        try {
          await onMoveTask(activeIdStr, targetListId, newOrder);
        } catch (error) {
          console.error('Failed to move task:', error);
          // Revert will happen via subscription
          if (previousTasks) {
            queryClient.setQueryData(
              queryKeys.boards.tasks(boardId),
              previousTasks,
            );
          }
        }
      }
    } else if (activeData?.type === 'list') {
      // Reordering lists
      const sortedLists = [...lists].sort((a, b) =>
        compareOrder(a.order, b.order),
      );
      const activeIndex = sortedLists.findIndex((l) => l.id === activeIdStr);
      const overIndex = sortedLists.findIndex((l) => l.id === overIdStr);

      if (activeIndex === -1 || overIndex === -1) return;

      // Calculate the fractional order key for the new position
      const otherLists = sortedLists.filter((l) => l.id !== activeIdStr);
      const newOrder = getOrderAtIndex(otherLists, overIndex);

      // Optimistic update via React Query cache
      const previousLists = queryClient.getQueryData<List[]>(
        queryKeys.boards.lists(boardId),
      );

      if (previousLists) {
        const updatedLists = previousLists.map((list) => {
          if (list.id === activeIdStr) {
            return { ...list, order: newOrder };
          }
          return list;
        });
        queryClient.setQueryData(queryKeys.boards.lists(boardId), updatedLists);
      }

      // Sync with server
      if (onReorderLists) {
        try {
          await onReorderLists(activeIdStr, newOrder);
        } catch (error) {
          console.error('Failed to reorder lists:', error);
          // Revert
          if (previousLists) {
            queryClient.setQueryData(
              queryKeys.boards.lists(boardId),
              previousLists,
            );
          }
        }
      }
    }
  };

  return {
    activeId,
    activeType,
    overId,
    getActiveTask,
    getActiveList,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
};
