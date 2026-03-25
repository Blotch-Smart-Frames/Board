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
import { TaskDetailDialog } from './TaskDetailDialog';
import { BoardBackground } from './BoardBackground';
import { BackgroundImageUpload } from './BackgroundImageUpload';
import { TimelineView } from '../timeline';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { useBoardQuery } from '../../hooks/useBoardQuery';
import { compareOrder, getOrderAtEnd } from '../../utils/ordering';
import { useLabelsQuery } from '../../hooks/useLabelsQuery';
import { useSprintsQuery } from '../../hooks/useSprintsQuery';
import { useCalendarSync } from '../../hooks/useCalendarSync';
import { useAuthQuery } from '../../hooks/useAuthQuery';
import { addTaskHistory } from '../../services/boardService';
import { diffTaskChanges } from '../../utils/taskHistoryDiff';
import type {
  Task as TaskType,
  Attachment,
  CreateTaskInput,
  UpdateTaskInput,
  HistoryEntry,
} from '../../types/board';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';
import { AssigneeFilter } from './AssigneeFilter';
import { LabelFilter } from './LabelFilter';

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
  const { user } = useAuthQuery();

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [addingToListId, setAddingToListId] = useState<string | null>(null);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(
    null,
  );
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);

  const filteredTasks = tasks
    .filter(
      (t) => !selectedAssigneeId || t.assignedTo?.includes(selectedAssigneeId),
    )
    .filter(
      (t) =>
        selectedLabelIds.length === 0 ||
        t.labelIds?.some((id) => selectedLabelIds.includes(id)),
    );

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

  const viewingTask = viewingTaskId
    ? (tasks.find((t) => t.id === viewingTaskId) ?? null)
    : null;

  const handleEditTask = (task: TaskType) => setEditingTaskId(task.id);
  const handleViewTask = (task: TaskType) => setViewingTaskId(task.id);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragMoveTask = async (
    taskId: string,
    newListId: string,
    newOrder: string,
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task && user && task.listId !== newListId) {
      const fromList = sortedLists.find((l) => l.id === task.listId);
      const toList = sortedLists.find((l) => l.id === newListId);
      addTaskHistory(boardId, taskId, [
        {
          action: 'moved',
          userId: user.uid,
          metadata: {
            fromListName: fromList?.title ?? '',
            toListName: toList?.title ?? '',
          },
        },
      ]).catch(() => {});
    }
    return moveTask(taskId, newListId, newOrder);
  };

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
    onMoveTask: handleDragMoveTask,
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
        const updates = data as UpdateTaskInput;
        await updateTask(editingTask.id, updates);
        const updatedTask = { ...editingTask, ...data };
        if (updatedTask.calendarSyncEnabled && updatedTask.dueDate) {
          await syncTaskToCalendar(updatedTask as TaskType);
        }
        if (user) {
          const entries = diffTaskChanges(editingTask, updates, {
            userId: user.uid,
            labels,
            collaborators,
            lists: sortedLists,
            sprints,
          });
          if (entries.length > 0) {
            addTaskHistory(boardId, editingTask.id, entries).catch(() => {});
          }
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

  const handleUpdateTask = async (taskId: string, updates: UpdateTaskInput) => {
    const task = tasks.find((t) => t.id === taskId);
    await updateTask(taskId, updates);
    if (task && user && updates.completedAt !== undefined) {
      const wasCompleted = !!task.completedAt;
      const isNowCompleted = !!updates.completedAt;
      if (wasCompleted !== isNowCompleted) {
        addTaskHistory(boardId, taskId, [
          {
            action: isNowCompleted ? 'completed' : 'reopened',
            userId: user.uid,
          },
        ]).catch(() => {});
      }
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
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1 }}
        >
          <LabelFilter
            labels={labels}
            selectedLabelIds={selectedLabelIds}
            onFilterChange={setSelectedLabelIds}
          />
          <AssigneeFilter
            collaborators={collaborators}
            selectedAssigneeId={selectedAssigneeId}
            onFilterChange={setSelectedAssigneeId}
          />
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
                      onViewTask={handleViewTask}
                      onUpdateTask={handleUpdateTask}
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

        <TaskDetailDialog
          open={!!viewingTask}
          boardId={boardId}
          task={viewingTask}
          labels={labels}
          lists={sortedLists}
          collaborators={collaborators}
          onClose={() => setViewingTaskId(null)}
          onEdit={() => {
            if (viewingTask) {
              setViewingTaskId(null);
              setEditingTaskId(viewingTask.id);
            }
          }}
          onAttachmentsChange={(attachments: Attachment[]) => {
            if (viewingTask) {
              updateTask(viewingTask.id, { attachments });
              if (user) {
                const oldAttachments = viewingTask.attachments ?? [];
                const oldIds = new Set(oldAttachments.map((a) => a.id));
                const newIds = new Set(attachments.map((a) => a.id));
                const entries: Omit<HistoryEntry, 'id' | 'createdAt'>[] = [];
                for (const a of attachments) {
                  if (!oldIds.has(a.id)) {
                    entries.push({
                      action: 'attachment_added',
                      userId: user.uid,
                      metadata: { fileName: a.fileName },
                    });
                  }
                }
                for (const a of oldAttachments) {
                  if (!newIds.has(a.id)) {
                    entries.push({
                      action: 'attachment_removed',
                      userId: user.uid,
                      metadata: { fileName: a.fileName },
                    });
                  }
                }
                if (entries.length > 0) {
                  addTaskHistory(boardId, viewingTask.id, entries).catch(
                    () => {},
                  );
                }
              }
            }
          }}
          onAssigneesChange={(userIds) => {
            if (viewingTask) {
              updateTask(viewingTask.id, { assignedTo: userIds });
            }
          }}
          onMoveTask={(newListId) => {
            if (viewingTask && newListId !== viewingTask.listId) {
              const targetListTasks = tasks.filter(
                (t) => t.listId === newListId,
              );
              const newOrder = getOrderAtEnd(targetListTasks);
              moveTask(viewingTask.id, newListId, newOrder);
              if (user) {
                const fromList = sortedLists.find(
                  (l) => l.id === viewingTask.listId,
                );
                const toList = sortedLists.find((l) => l.id === newListId);
                addTaskHistory(boardId, viewingTask.id, [
                  {
                    action: 'moved',
                    userId: user.uid,
                    metadata: {
                      fromListName: fromList?.title ?? '',
                      toListName: toList?.title ?? '',
                    },
                  },
                ]).catch(() => {});
              }
            }
          }}
        />

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
