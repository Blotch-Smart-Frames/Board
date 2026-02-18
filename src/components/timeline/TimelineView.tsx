import { useState, useCallback } from 'react';
import {
  TimelineContext,
  type DragEndEvent,
  type ResizeEndEvent,
} from 'dnd-timeline';
import { Box, Typography, Alert, Chip } from '@mui/material';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import { TimelineContent } from './TimelineContent';
import { useTimelineData } from '../../hooks/useTimelineData';
import type {
  Task,
  List,
  Label,
  Sprint,
  UpdateTaskInput,
} from '../../types/board';
import { getOrderAtEnd } from '../../utils/ordering';

type Span = { start: number; end: number };

type TimelineViewProps = {
  tasks: Task[];
  lists: List[];
  labels: Label[];
  sprints: Sprint[];
  onUpdateTask: (taskId: string, updates: UpdateTaskInput) => Promise<void>;
  onEditTask: (task: Task) => void;
  moveTask: (
    taskId: string,
    newListId: string,
    newOrder: string,
  ) => Promise<void>;
};

const DEFAULT_RANGE_DAYS = 14;

export const TimelineView = ({
  tasks,
  lists,
  labels,
  sprints,
  onUpdateTask,
  onEditTask,
  moveTask,
}: TimelineViewProps) => {
  const {
    items: serverItems,
    rows,
    hiddenCount,
  } = useTimelineData(tasks, lists);

  // Optimistic span overrides - updated immediately on drag/resize
  const [spanOverrides, setSpanOverrides] = useState<Map<string, Span>>(
    () => new Map(),
  );

  // Optimistic row overrides - updated immediately on cross-lane drag
  const [rowOverrides, setRowOverrides] = useState<Map<string, string>>(
    () => new Map(),
  );

  // Force remount of items after resize to clear library's stale closures
  const [remountKeys, setRemountKeys] = useState<Map<string, number>>(
    () => new Map(),
  );

  // Clear overrides when server data updates (after Firebase sync)
  const [prevTasks, setPrevTasks] = useState(tasks);
  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setSpanOverrides(new Map());
    setRowOverrides(new Map());
    setRemountKeys(new Map());
  }

  // Apply optimistic overrides to items
  const items =
    spanOverrides.size === 0 && rowOverrides.size === 0
      ? serverItems
      : serverItems.map((item) => {
          const spanOverride = spanOverrides.get(item.id);
          const rowOverride = rowOverrides.get(item.id);
          if (!spanOverride && !rowOverride) return item;
          return {
            ...item,
            ...(spanOverride && { span: spanOverride }),
            ...(rowOverride && { rowId: rowOverride }),
          };
        });

  const [range, setRange] = useState(() => {
    const today = startOfDay(new Date());
    return {
      start: addDays(today, -3).getTime(),
      end: endOfDay(addDays(today, DEFAULT_RANGE_DAYS)).getTime(),
    };
  });

  const EXPANSION_DAYS = 7;

  const handleExpandPast = useCallback(() => {
    setRange((prev) => ({
      ...prev,
      start: addDays(new Date(prev.start), -EXPANSION_DAYS).getTime(),
    }));
  }, []);

  const handleExpandFuture = useCallback(() => {
    setRange((prev) => ({
      ...prev,
      end: endOfDay(addDays(new Date(prev.end), EXPANSION_DAYS)).getTime(),
    }));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const activeId = event.active.id as string;
      const activeItem = items.find((item) => item.id === activeId);
      if (!activeItem) return;

      const getSpanFromDragEvent =
        event.active.data.current?.getSpanFromDragEvent;
      if (!getSpanFromDragEvent) return;

      const updatedSpan = getSpanFromDragEvent(event) as Span | null;
      if (!updatedSpan) return;

      // Detect lane/list change from drop target
      const overData = event.over?.data.current;
      const targetListId =
        overData?.type === 'timeline-row'
          ? overData.listId
          : activeItem.task.listId;

      const isListChange = targetListId !== activeItem.task.listId;

      // Optimistic span update
      setSpanOverrides((prev) => new Map(prev).set(activeId, updatedSpan));

      if (isListChange) {
        // Optimistic row update
        setRowOverrides((prev) => new Map(prev).set(activeId, targetListId));

        // Calculate order (append to end of destination list)
        const destListTasks = tasks.filter((t) => t.listId === targetListId);
        const newOrder = getOrderAtEnd(destListTasks);

        // Persist list change, then date change
        await moveTask(activeId, targetListId, newOrder);
        await onUpdateTask(activeId, {
          startDate: new Date(updatedSpan.start),
          dueDate: new Date(updatedSpan.end),
        });
      } else {
        // Only dates changed
        onUpdateTask(activeId, {
          startDate: new Date(updatedSpan.start),
          dueDate: new Date(updatedSpan.end),
        });
      }
    },
    [items, tasks, onUpdateTask, moveTask],
  );

  const handleResizeEnd = useCallback(
    (event: ResizeEndEvent) => {
      const activeId = event.active.id as string;

      const getSpanFromResizeEvent =
        event.active.data.current?.getSpanFromResizeEvent;
      if (!getSpanFromResizeEvent) return;

      const updatedSpan = getSpanFromResizeEvent(event) as Span | null;
      if (!updatedSpan) return;

      // Optimistic update - immediately update local state
      setSpanOverrides((prev) => new Map(prev).set(activeId, updatedSpan));

      // Force remount to clear library's stale closures
      setRemountKeys((prev) => {
        const newKeys = new Map(prev);
        newKeys.set(activeId, (newKeys.get(activeId) || 0) + 1);
        return newKeys;
      });

      // Persist to server (async, non-blocking)
      onUpdateTask(activeId, {
        startDate: new Date(updatedSpan.start),
        dueDate: new Date(updatedSpan.end),
      });
    },
    [onUpdateTask],
  );

  const handleRangeChanged = useCallback(
    (
      updateFn: (prev: { start: number; end: number }) => {
        start: number;
        end: number;
      },
    ) => {
      setRange(updateFn);
    },
    [],
  );

  if (rows.length === 0) {
    return (
      <Box className="flex h-full items-center justify-center p-4">
        <Typography color="text.secondary">
          No lists in this board. Add a list to start using the timeline.
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="flex h-full flex-col overflow-hidden">
      {hiddenCount > 0 && (
        <Alert severity="info" sx={{ mx: 2, mt: 2, mb: 0 }}>
          <Box className="flex items-center gap-2">
            <Typography variant="body2">
              {hiddenCount} task{hiddenCount !== 1 ? 's' : ''} hidden.
            </Typography>
            <Chip
              label="Tasks need both start and due dates to appear"
              size="small"
              variant="outlined"
            />
          </Box>
        </Alert>
      )}

      {items.length === 0 && hiddenCount === 0 && (
        <Box className="flex h-full items-center justify-center p-4">
          <Typography color="text.secondary">
            No tasks in this board yet.
          </Typography>
        </Box>
      )}

      {items.length === 0 && hiddenCount > 0 && (
        <Box className="flex h-full items-center justify-center p-4">
          <Typography color="text.secondary">
            Set start and due dates on tasks to see them in the timeline.
          </Typography>
        </Box>
      )}

      {items.length > 0 && (
        <TimelineContext
          range={range}
          onRangeChanged={handleRangeChanged}
          onDragEnd={handleDragEnd}
          onResizeEnd={handleResizeEnd}
        >
          <TimelineContent
            rows={rows}
            items={items}
            labels={labels}
            sprints={sprints}
            remountKeys={remountKeys}
            onEditTask={onEditTask}
            onExpandPast={handleExpandPast}
            onExpandFuture={handleExpandFuture}
          />
        </TimelineContext>
      )}
    </Box>
  );
};
