import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useDragAndDrop } from './useDragAndDrop';
import type {
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { Timestamp } from 'firebase/firestore';

const mockTimestamp = {
  toDate: () => new Date(),
} as Timestamp;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useDragAndDrop', () => {
  const mockMoveTask = vi.fn();
  const mockReorderLists = vi.fn();

  const mockLists = [
    { id: 'list-1', title: 'To Do', order: 'a0', createdAt: mockTimestamp },
    { id: 'list-2', title: 'Done', order: 'a1', createdAt: mockTimestamp },
  ];

  const mockTasks = [
    {
      id: 'task-1',
      listId: 'list-1',
      title: 'Task 1',
      order: 'a0',
      calendarSyncEnabled: false,
      createdBy: 'user-1',
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    },
    {
      id: 'task-2',
      listId: 'list-1',
      title: 'Task 2',
      order: 'a1',
      calendarSyncEnabled: false,
      createdBy: 'user-1',
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with null active state', () => {
    const { result } = renderHook(
      () =>
        useDragAndDrop({
          boardId: 'board-1',
          lists: mockLists,
          tasks: mockTasks,
          onMoveTask: mockMoveTask,
          onReorderLists: mockReorderLists,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.activeId).toBeNull();
    expect(result.current.activeType).toBeNull();
    expect(result.current.overId).toBeNull();
  });

  it('sets active task on drag start', () => {
    const { result } = renderHook(
      () =>
        useDragAndDrop({
          boardId: 'board-1',
          lists: mockLists,
          tasks: mockTasks,
          onMoveTask: mockMoveTask,
          onReorderLists: mockReorderLists,
        }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.handleDragStart({
        active: {
          id: 'task-1',
          data: { current: { type: 'task' } },
        },
      } as unknown as DragStartEvent);
    });

    expect(result.current.activeId).toBe('task-1');
    expect(result.current.activeType).toBe('task');
  });

  it('sets over id on drag over', () => {
    const { result } = renderHook(
      () =>
        useDragAndDrop({
          boardId: 'board-1',
          lists: mockLists,
          tasks: mockTasks,
          onMoveTask: mockMoveTask,
          onReorderLists: mockReorderLists,
        }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.handleDragOver({
        over: { id: 'task-2' },
      } as DragOverEvent);
    });

    expect(result.current.overId).toBe('task-2');
  });

  it('resets state on drag end', () => {
    const { result } = renderHook(
      () =>
        useDragAndDrop({
          boardId: 'board-1',
          lists: mockLists,
          tasks: mockTasks,
          onMoveTask: mockMoveTask,
          onReorderLists: mockReorderLists,
        }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.handleDragStart({
        active: {
          id: 'task-1',
          data: { current: { type: 'task' } },
        },
      } as unknown as DragStartEvent);
    });

    act(() => {
      result.current.handleDragEnd({
        active: {
          id: 'task-1',
          data: { current: { type: 'task' } },
        },
        over: null,
      } as unknown as DragEndEvent);
    });

    expect(result.current.activeId).toBeNull();
    expect(result.current.activeType).toBeNull();
  });

  it('does nothing when dropping on same position', async () => {
    const { result } = renderHook(
      () =>
        useDragAndDrop({
          boardId: 'board-1',
          lists: mockLists,
          tasks: mockTasks,
          onMoveTask: mockMoveTask,
          onReorderLists: mockReorderLists,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      result.current.handleDragEnd({
        active: {
          id: 'task-1',
          data: { current: { type: 'task' } },
        },
        over: {
          id: 'task-1',
          data: { current: { type: 'task' } },
        },
      } as unknown as DragEndEvent);
    });

    expect(mockMoveTask).not.toHaveBeenCalled();
  });
});
