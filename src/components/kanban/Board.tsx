import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  ViewKanban as KanbanIcon,
  ViewTimeline as TimelineIcon,
} from '@mui/icons-material';
import { List } from './List';
import { Task } from './Task';
import { AddListButton } from './AddListButton';
import { TaskDialog } from './TaskDialog';
import { TimelineView } from '../timeline';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { useBoardQuery } from '../../hooks/useBoardQuery';
import { useLabelsQuery } from '../../hooks/useLabelsQuery';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import type {
  Task as TaskType,
  CreateTaskInput,
  UpdateTaskInput,
} from '../../types/board';

type ViewMode = 'kanban' | 'timeline';

type BoardProps = {
  boardId: string;
};

export function Board({ boardId }: BoardProps) {
  const {
    board,
    lists,
    tasks,
    isLoading,
    error,
    addList,
    updateList,
    deleteList,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
  } = useBoardQuery(boardId);

  const { labels } = useLabelsQuery(boardId);

  const sortedLists = [...lists].sort((a, b) => a.order - b.order);
  const listsWithTasks = sortedLists.map((list) => ({
    ...list,
    tasks: tasks
      .filter((task) => task.listId === list.id)
      .sort((a, b) => a.order - b.order),
  }));
  const { syncTaskToCalendar } = useCalendarSync(boardId, tasks);

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [addingToListId, setAddingToListId] = useState<string | null>(null);

  const editingTask = editingTaskId
    ? tasks.find((t) => t.id === editingTaskId) ?? null
    : null;

  const handleEditTask = (task: TaskType) => setEditingTaskId(task.id);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const {
    activeId,
    getActiveTask,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useDragAndDrop({
    boardId,
    lists,
    tasks,
    onMoveTask: moveTask,
  });

  const handleAddList = async (title: string) => {
    try {
      await addList({ title });
    } catch (err) {
      console.error('Failed to add list:', err);
    }
  };

  const handleUpdateListTitle = async (listId: string, title: string) => {
    try {
      await updateList(listId, { title });
    } catch (err) {
      console.error('Failed to update list:', err);
    }
  };

  const handleDeleteList = async (listId: string) => {
    try {
      await deleteList(listId);
    } catch (err) {
      console.error('Failed to delete list:', err);
    }
  };

  const handleAddTask = async (listId: string, input: CreateTaskInput) => {
    try {
      const task = await addTask(listId, input);
      if (task.calendarSyncEnabled && task.dueDate) {
        await syncTaskToCalendar(task);
      }
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  const handleSaveTask = async (data: CreateTaskInput | UpdateTaskInput) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, data as UpdateTaskInput);
        const updatedTask = { ...editingTask, ...data };
        if (updatedTask.calendarSyncEnabled && updatedTask.dueDate) {
          await syncTaskToCalendar(updatedTask as TaskType);
        }
      } else if (addingToListId) {
        const task = await addTask(addingToListId, data as CreateTaskInput);
        if (task.calendarSyncEnabled && task.dueDate) {
          await syncTaskToCalendar(task);
        }
      }
    } catch (err) {
      console.error('Failed to save task:', err);
    }
  };

  const handleDeleteTask = async () => {
    if (!editingTask) return;
    try {
      await deleteTask(editingTask.id);
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const activeTask = getActiveTask();

  if (isLoading) {
    return (
      <Box className="flex items-center justify-center h-full">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="flex items-center justify-center h-full p-4">
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!board) {
    return (
      <Box className="flex items-center justify-center h-full">
        <Typography color="text.secondary">Board not found</Typography>
      </Box>
    );
  }

  const handleViewModeChange = (
    _: React.MouseEvent<HTMLElement>,
    newMode: ViewMode | null,
  ) => {
    if (newMode) {
      setViewMode(newMode);
    }
  };

  return (
    <Box className="h-full flex flex-col">
      <Box className="px-4 py-3 bg-white/50 backdrop-blur-sm border-b flex items-center justify-between">
        <Typography variant="h5" component="h1" className="font-semibold">
          {board.title}
        </Typography>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          size="small"
        >
          <ToggleButton value="kanban" aria-label="Kanban view">
            <KanbanIcon sx={{ mr: 0.5 }} />
            Kanban
          </ToggleButton>
          <ToggleButton value="timeline" aria-label="Timeline view">
            <TimelineIcon sx={{ mr: 0.5 }} />
            Timeline
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {viewMode === 'kanban' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <Box className="flex-1 overflow-x-auto overflow-y-hidden p-4">
            <Box className="flex gap-4 h-full items-start">
              {listsWithTasks.map((list) => (
                <List
                  key={list.id}
                  list={list}
                  tasks={list.tasks}
                  labels={labels}
                  onUpdateTitle={(title) =>
                    handleUpdateListTitle(list.id, title)
                  }
                  onDelete={() => handleDeleteList(list.id)}
                  onAddTask={(input) => handleAddTask(list.id, input)}
                  onEditTask={handleEditTask}
                  onUpdateTask={updateTask}
                />
              ))}

              <AddListButton onAdd={handleAddList} />
            </Box>
          </Box>

          <DragOverlay>
            {activeId && activeTask ? (
              <Task task={activeTask} labels={labels} isDragging />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <TimelineView
          tasks={tasks}
          lists={lists}
          labels={labels}
          onUpdateTask={updateTask}
          onEditTask={handleEditTask}
        />
      )}

      <TaskDialog
        key={
          editingTask
            ? `${editingTask.id}-${editingTask.startDate?.seconds ?? 0}-${editingTask.dueDate?.seconds ?? 0}`
            : addingToListId ?? 'closed'
        }
        open={!!editingTask || !!addingToListId}
        boardId={boardId}
        task={editingTask}
        onClose={() => {
          setEditingTaskId(null);
          setAddingToListId(null);
        }}
        onSave={handleSaveTask}
        onDelete={editingTask ? handleDeleteTask : undefined}
      />
    </Box>
  );
}
