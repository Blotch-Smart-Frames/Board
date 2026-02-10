import { useState } from "react";
import type {
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../queries/queryKeys";
import type { Task, List } from "../types/board";

type UseDragAndDropOptions = {
  boardId: string | null;
  lists: List[];
  tasks: Task[];
  onMoveTask?: (
    taskId: string,
    newListId: string,
    newOrder: number,
  ) => Promise<void>;
  onReorderLists?: (orderedIds: string[]) => Promise<void>;
};

export const useDragAndDrop = (options: UseDragAndDropOptions) => {
  const { boardId, lists, tasks, onMoveTask, onReorderLists } = options;
  const queryClient = useQueryClient();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"task" | "list" | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const getActiveTask = (): Task | undefined => {
    if (activeType !== "task" || !activeId) return undefined;
    return tasks.find((t) => t.id === activeId);
  };

  const getActiveList = (): List | undefined => {
    if (activeType !== "list" || !activeId) return undefined;
    return lists.find((l) => l.id === activeId);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const type = active.data.current?.type as "task" | "list";

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

    if (activeData?.type === "task") {
      const activeTask = tasks.find((t) => t.id === activeIdStr);
      if (!activeTask) return;

      let targetListId: string;
      let targetOrder: number;

      if (overData?.type === "task") {
        // Dropping on another task
        const overTask = tasks.find((t) => t.id === overIdStr);
        if (!overTask) return;

        targetListId = overTask.listId;
        const listTasks = tasks
          .filter((t) => t.listId === targetListId)
          .sort((a, b) => a.order - b.order);

        const overIndex = listTasks.findIndex((t) => t.id === overIdStr);

        if (activeTask.listId === targetListId) {
          // Same list reorder
          const activeIndex = listTasks.findIndex((t) => t.id === activeIdStr);
          const newTasks = arrayMove(listTasks, activeIndex, overIndex);
          targetOrder = newTasks.findIndex((t) => t.id === activeIdStr);
        } else {
          // Cross-list move
          targetOrder = overIndex;
        }
      } else if (overData?.type === "list") {
        // Dropping on an empty list
        targetListId = overIdStr;
        targetOrder = 0;
      } else {
        return;
      }

      // Optimistic update via React Query cache
      const previousTasks = queryClient.getQueryData<Task[]>(
        queryKeys.boards.tasks(boardId)
      );

      if (previousTasks) {
        const updatedTasks = previousTasks.map((task) => {
          if (task.id === activeIdStr) {
            return { ...task, listId: targetListId, order: targetOrder };
          }
          // Reorder other tasks in the destination list
          if (task.listId === targetListId && task.id !== activeIdStr) {
            const currentOrder = task.order;
            if (currentOrder >= targetOrder) {
              return { ...task, order: currentOrder + 1 };
            }
          }
          return task;
        });
        queryClient.setQueryData(queryKeys.boards.tasks(boardId), updatedTasks);
      }

      // Sync with server
      if (onMoveTask) {
        try {
          await onMoveTask(activeIdStr, targetListId, targetOrder);
        } catch (error) {
          console.error("Failed to move task:", error);
          // Revert will happen via subscription
          if (previousTasks) {
            queryClient.setQueryData(queryKeys.boards.tasks(boardId), previousTasks);
          }
        }
      }
    } else if (activeData?.type === "list") {
      // Reordering lists
      const activeIndex = lists.findIndex((l) => l.id === activeIdStr);
      const overIndex = lists.findIndex((l) => l.id === overIdStr);

      if (activeIndex === -1 || overIndex === -1) return;

      const newLists = arrayMove(lists, activeIndex, overIndex);
      const orderedIds = newLists.map((l) => l.id);

      // Optimistic update via React Query cache
      const previousLists = queryClient.getQueryData<List[]>(
        queryKeys.boards.lists(boardId)
      );

      if (previousLists) {
        const updatedLists = orderedIds.map((id, index) => {
          const list = previousLists.find((l) => l.id === id);
          return list ? { ...list, order: index } : null;
        }).filter((l): l is List => l !== null);
        queryClient.setQueryData(queryKeys.boards.lists(boardId), updatedLists);
      }

      // Sync with server
      if (onReorderLists) {
        try {
          await onReorderLists(orderedIds);
        } catch (error) {
          console.error("Failed to reorder lists:", error);
          // Revert
          if (previousLists) {
            queryClient.setQueryData(queryKeys.boards.lists(boardId), previousLists);
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
