import { useState, useCallback } from 'react';
import {
  TimelineContext,
  useTimelineContext,
  type DragEndEvent,
  type ResizeEndEvent,
} from 'dnd-timeline';
import { Box, Typography, Alert, Chip } from '@mui/material';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import { TimelineHeader } from './TimelineHeader';
import { TimelineRow } from './TimelineRow';
import { TimelineItem } from './TimelineItem';
import { CurrentTimeLine } from './CurrentTimeLine';
import {
  useTimelineData,
  type TimelineItem as TimelineItemType,
} from '../../hooks/useTimelineData';
import type { Task, List, Label, UpdateTaskInput } from '../../types/board';

type Span = { start: number; end: number };

type TimelineViewProps = {
  tasks: Task[];
  lists: List[];
  labels: Label[];
  onUpdateTask: (taskId: string, updates: UpdateTaskInput) => Promise<void>;
  onEditTask: (task: Task) => void;
};

type TimelineContentProps = {
  rows: { id: string; title: string }[];
  items: TimelineItemType[];
  labels: Label[];
  remountKeys: Map<string, number>;
  onEditTask: (task: Task) => void;
};

function TimelineContent({
  rows,
  items,
  labels,
  remountKeys,
  onEditTask,
}: TimelineContentProps) {
  const { setTimelineRef, style } = useTimelineContext();

  return (
    <Box
      sx={{
        flex: 1,
        overflow: 'auto',
        mt: 2,
        mx: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        backgroundColor: 'white',
      }}
    >
      <Box sx={{ display: 'flex', minWidth: 'fit-content' }}>
        {/* Left sidebar with list names */}
        <Box sx={{ flexShrink: 0, width: '200px' }}>
          {/* Header label cell */}
          <Box
            sx={{
              height: '40px',
              borderBottom: '2px solid',
              borderRight: '1px solid',
              borderColor: 'divider',
              backgroundColor: 'grey.100',
              px: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              Lists
            </Typography>
          </Box>
          {/* Row label cells */}
          {rows.map((row) => (
            <Box
              key={row.id}
              sx={{
                height: '48px',
                borderBottom: '1px solid',
                borderRight: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'grey.50',
                px: 2,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography
                variant="body2"
                fontWeight={500}
                sx={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {row.title}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Timeline area */}
        <Box
          ref={setTimelineRef}
          sx={{
            ...style,
            flex: 1,
            minWidth: 0,
            position: 'relative',
          }}
        >
          <CurrentTimeLine />
          {/* Header row */}
          <Box
            sx={{
              height: '40px',
              borderBottom: '2px solid',
              borderColor: 'divider',
              backgroundColor: 'grey.100',
              position: 'relative',
            }}
          >
            <TimelineHeader />
          </Box>
          {/* Data rows */}
          {rows.map((row) => {
            const rowItems = items.filter((item) => item.rowId === row.id);
            return (
              <TimelineRow key={row.id} row={row}>
                {rowItems.map((item) => (
                  <TimelineItem
                    key={`${item.id}-${remountKeys.get(item.id) || 0}`}
                    item={item}
                    labels={labels}
                    onClick={() => onEditTask(item.task)}
                  />
                ))}
              </TimelineRow>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

const DEFAULT_RANGE_DAYS = 14;

export function TimelineView({
  tasks,
  lists,
  labels,
  onUpdateTask,
  onEditTask,
}: TimelineViewProps) {
  const {
    items: serverItems,
    rows,
    hiddenCount,
  } = useTimelineData(tasks, lists);

  // Optimistic span overrides - updated immediately on drag/resize
  const [spanOverrides, setSpanOverrides] = useState<Map<string, Span>>(
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
    setRemountKeys(new Map());
  }

  // Apply optimistic overrides to items
  const items =
    spanOverrides.size === 0
      ? serverItems
      : serverItems.map((item) => {
          const override = spanOverrides.get(item.id);
          if (!override) return item;
          return { ...item, span: override };
        });

  const [range, setRange] = useState(() => {
    const today = startOfDay(new Date());
    return {
      start: addDays(today, -3).getTime(),
      end: endOfDay(addDays(today, DEFAULT_RANGE_DAYS)).getTime(),
    };
  });

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = event.active.id as string;

      const getSpanFromDragEvent =
        event.active.data.current?.getSpanFromDragEvent;
      if (!getSpanFromDragEvent) return;

      const updatedSpan = getSpanFromDragEvent(event) as Span | null;
      if (!updatedSpan) return;

      // Optimistic update - immediately update local state
      setSpanOverrides((prev) => new Map(prev).set(activeId, updatedSpan));

      // Persist to server (async, non-blocking)
      onUpdateTask(activeId, {
        startDate: new Date(updatedSpan.start),
        dueDate: new Date(updatedSpan.end),
      });
    },
    [onUpdateTask],
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
      <Box className="flex items-center justify-center h-full p-4">
        <Typography color="text.secondary">
          No lists in this board. Add a list to start using the timeline.
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="h-full flex flex-col overflow-hidden">
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
        <Box className="flex items-center justify-center h-full p-4">
          <Typography color="text.secondary">
            No tasks in this board yet.
          </Typography>
        </Box>
      )}

      {items.length === 0 && hiddenCount > 0 && (
        <Box className="flex items-center justify-center h-full p-4">
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
            remountKeys={remountKeys}
            onEditTask={onEditTask}
          />
        </TimelineContext>
      )}
    </Box>
  );
}
