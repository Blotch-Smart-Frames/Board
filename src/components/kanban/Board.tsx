import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { List } from './List';
import { ListPreview } from './ListPreview';
import { Task } from './Task';
import { AddListButton } from './AddListButton';
import { TaskDialog } from './TaskDialog';
import { BoardBackground } from './BoardBackground';
import { BackgroundImageUpload } from './BackgroundImageUpload';
import { TimelineView } from '../timeline';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { useBoardQuery } from '../../hooks/useBoardQuery';
import { compareOrder } from '../../utils/ordering';
import { useLabelsQuery } from '../../hooks/useLabelsQuery';
import { useSprintsQuery } from '../../hooks/useSprintsQuery';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import type {
  Task as TaskType,
  CreateTaskInput,
  UpdateTaskInput,
} from '../../types/board';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';
import { AssigneeFilter } from './AssigneeFilter';

type BoardProps = {
  boardId: string;
  viewMode: 'kanban' | 'timeline';
  collaborators?: Collaborator[];
};

export const Board = ({
  boardId,
  viewMode,
  collaborators = [],
}: BoardProps) => {
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
    reorderLists,
  } = useBoardQuery(boardId);

  const { labels } = useLabelsQuery(boardId);
  const { sprints } = useSprintsQuery(boardId);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [addingToListId, setAddingToListId] = useState<string | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(
    null,
  );

  const filteredTasks = selectedAssigneeId
    ? tasks.filter((t) => t.assignedTo?.includes(selectedAssigneeId))
    : tasks;

  const sortedLists = [...lists].sort((a, b) => compareOrder(a.order, b.order));
  const listsWithTasks = sortedLists.map((list) => ({
    ...list,
    tasks: filteredTasks
      .filter((task) => task.listId === list.id)
      .sort((a, b) => compareOrder(a.order, b.order)),
  }));
  const { syncTaskToCalendar } = useCalendarSync(boardId, tasks);

  const editingTask = editingTaskId
    ? (tasks.find((t) => t.id === editingTaskId) ?? null)
    : null;

  const handleEditTask = (task: TaskType) => setEditingTaskId(task.id);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const {
    activeId,
    getActiveTask,
    getActiveList,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useDragAndDrop({
    boardId,
    lists,
    tasks,
    onMoveTask: moveTask,
    onReorderLists: reorderLists,
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
  const activeList = getActiveList();
  const listIds = sortedLists.map((l) => l.id);

  if (isLoading) {
    return (
      <Box className="flex h-full items-center justify-center">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="flex h-full items-center justify-center p-4">
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!board) {
    return (
      <Box className="flex h-full items-center justify-center">
        <Typography color="text.secondary">Board not found</Typography>
      </Box>
    );
  }

  return (
    <BoardBackground imageUrl={board.backgroundImageUrl}>
      <Box className="flex h-full flex-col">
        <AssigneeFilter
          collaborators={collaborators}
          selectedAssigneeId={selectedAssigneeId}
          onFilterChange={setSelectedAssigneeId}
        />
        {viewMode === 'kanban' ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <Box className="flex-1 overflow-x-auto overflow-y-hidden p-4">
              <SortableContext
                items={listIds}
                strategy={horizontalListSortingStrategy}
              >
                <Box className="flex h-full items-start gap-4">
                  {listsWithTasks.map((list) => (
                    <List
                      key={list.id}
                      list={list}
                      tasks={list.tasks}
                      labels={labels}
                      collaborators={collaborators}
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
              </SortableContext>
            </Box>

            <DragOverlay>
              {activeId && activeTask ? (
                <Task
                  task={activeTask}
                  labels={labels}
                  collaborators={collaborators}
                  isDragging
                />
              ) : activeId && activeList ? (
                <ListPreview
                  list={activeList}
                  taskCount={
                    listsWithTasks
                      .find((l) => l.id === activeList.id)
                      ?.tasks.filter((t) => !t.completedAt).length ?? 0
                  }
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <TimelineView
            tasks={filteredTasks}
            lists={lists}
            labels={labels}
            sprints={sprints}
            onUpdateTask={updateTask}
            onEditTask={handleEditTask}
            moveTask={moveTask}
          />
        )}

        <TaskDialog
          key={
            editingTask
              ? `${editingTask.id}-${editingTask.startDate?.seconds ?? 0}-${editingTask.dueDate?.seconds ?? 0}`
              : (addingToListId ?? 'closed')
          }
          open={!!editingTask || !!addingToListId}
          boardId={boardId}
          board={board}
          task={editingTask}
          collaborators={collaborators}
          onClose={() => {
            setEditingTaskId(null);
            setAddingToListId(null);
          }}
          onSave={handleSaveTask}
          onDelete={editingTask ? handleDeleteTask : undefined}
        />

        <BackgroundImageUpload
          boardId={boardId}
          hasBackground={!!board.backgroundImageUrl}
        />
      </Box>
    </BoardBackground>
  );
};
