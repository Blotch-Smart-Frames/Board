import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useBoardQuery, useListsWithTasks } from './useBoardQuery';

const mockOnSnapshot = vi.fn(() => vi.fn());

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [])),
  };
});

const mockAddList = vi.fn();
const mockUpdateList = vi.fn();
const mockDeleteList = vi.fn();
const mockAddTask = vi.fn();
const mockUpdateTask = vi.fn();
const mockDeleteTask = vi.fn();
const mockMoveTask = vi.fn();
const mockDeleteBoard = vi.fn();
const mockShareBoard = vi.fn();

vi.mock('../services/boardService', () => ({
  addList: (...args: unknown[]) => mockAddList(...args),
  updateList: (...args: unknown[]) => mockUpdateList(...args),
  deleteList: (...args: unknown[]) => mockDeleteList(...args),
  addTask: (...args: unknown[]) => mockAddTask(...args),
  updateTask: (...args: unknown[]) => mockUpdateTask(...args),
  deleteTask: (...args: unknown[]) => mockDeleteTask(...args),
  moveTask: (...args: unknown[]) => mockMoveTask(...args),
  deleteBoard: (...args: unknown[]) => mockDeleteBoard(...args),
  shareBoard: (...args: unknown[]) => mockShareBoard(...args),
}));

vi.mock('../queries/firestoreRefs', () => ({
  getBoardRef: vi.fn(),
  getBoardListsQuery: vi.fn(),
  getBoardTasksQuery: vi.fn(),
}));

vi.mock('./useAuthQuery', () => ({
  useAuthQuery: () => ({
    user: { uid: 'user-123' },
    accessToken: null,
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useBoardQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
  });

  it('returns default values when boardId is null', () => {
    const { result } = renderHook(() => useBoardQuery(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.board).toBeNull();
    expect(result.current.lists).toEqual([]);
    expect(result.current.tasks).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('sets up Firestore subscriptions when boardId is provided', () => {
    renderHook(() => useBoardQuery('board-1'), {
      wrapper: createWrapper(),
    });

    // Should subscribe to board, lists, and tasks (3 onSnapshot calls)
    expect(mockOnSnapshot).toHaveBeenCalledTimes(3);
  });

  it('does not set up subscriptions when boardId is null', () => {
    renderHook(() => useBoardQuery(null), {
      wrapper: createWrapper(),
    });

    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('unsubscribes from all snapshots on unmount', () => {
    const unsubscribe1 = vi.fn();
    const unsubscribe2 = vi.fn();
    const unsubscribe3 = vi.fn();
    mockOnSnapshot
      .mockReturnValueOnce(unsubscribe1)
      .mockReturnValueOnce(unsubscribe2)
      .mockReturnValueOnce(unsubscribe3);

    const { unmount } = renderHook(() => useBoardQuery('board-1'), {
      wrapper: createWrapper(),
    });

    unmount();

    expect(unsubscribe1).toHaveBeenCalled();
    expect(unsubscribe2).toHaveBeenCalled();
    expect(unsubscribe3).toHaveBeenCalled();
  });

  it('indicates loading when boardId exists but board data is null', () => {
    const { result } = renderHook(() => useBoardQuery('board-1'), {
      wrapper: createWrapper(),
    });

    // Board data hasn't arrived from Firestore yet
    expect(result.current.isLoading).toBe(true);
  });

  describe('list operations', () => {
    it('addList calls service with boardId and input', async () => {
      mockAddList.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoardQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.addList({ title: 'New List' });
      });

      expect(mockAddList).toHaveBeenCalledWith('board-1', {
        title: 'New List',
      });
    });

    it('addList throws when boardId is null', async () => {
      const { result } = renderHook(() => useBoardQuery(null), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.addList({ title: 'New List' }),
      ).rejects.toThrow('No board selected');
    });

    it('updateList calls service with boardId, listId, and updates', async () => {
      mockUpdateList.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoardQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.updateList('list-1', { title: 'Updated' });
      });

      expect(mockUpdateList).toHaveBeenCalledWith('board-1', 'list-1', {
        title: 'Updated',
      });
    });

    it('deleteList calls service with boardId and listId', async () => {
      mockDeleteList.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoardQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.deleteList('list-1');
      });

      expect(mockDeleteList).toHaveBeenCalledWith('board-1', 'list-1');
    });
  });

  describe('task operations', () => {
    it('addTask calls service with boardId, listId, input, and userId', async () => {
      mockAddTask.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoardQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.addTask('list-1', { title: 'New Task' });
      });

      expect(mockAddTask).toHaveBeenCalledWith(
        'board-1',
        'list-1',
        { title: 'New Task' },
        'user-123',
      );
    });

    it('addTask throws when boardId is null', async () => {
      const { result } = renderHook(() => useBoardQuery(null), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.addTask('list-1', { title: 'New Task' }),
      ).rejects.toThrow();
    });

    it('updateTask calls service with boardId, taskId, and updates', async () => {
      mockUpdateTask.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoardQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.updateTask('task-1', { title: 'Updated Task' });
      });

      expect(mockUpdateTask).toHaveBeenCalledWith('board-1', 'task-1', {
        title: 'Updated Task',
      });
    });

    it('deleteTask calls service with boardId and taskId', async () => {
      mockDeleteTask.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoardQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.deleteTask('task-1');
      });

      expect(mockDeleteTask).toHaveBeenCalledWith('board-1', 'task-1');
    });

    it('moveTask calls service with boardId, taskId, newListId, and newOrder', async () => {
      mockMoveTask.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoardQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.moveTask('task-1', 'list-2', 0);
      });

      expect(mockMoveTask).toHaveBeenCalledWith(
        'board-1',
        'task-1',
        'list-2',
        0,
      );
    });
  });

  describe('board operations', () => {
    it('deleteBoard calls service with boardId', async () => {
      mockDeleteBoard.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoardQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.deleteBoard();
      });

      expect(mockDeleteBoard).toHaveBeenCalledWith('board-1');
    });

    it('deleteBoard throws when boardId is null', async () => {
      const { result } = renderHook(() => useBoardQuery(null), {
        wrapper: createWrapper(),
      });

      await expect(result.current.deleteBoard()).rejects.toThrow(
        'No board selected',
      );
    });

    it('shareBoard calls service with boardId and userId', async () => {
      mockShareBoard.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoardQuery('board-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.shareBoard('user-456');
      });

      expect(mockShareBoard).toHaveBeenCalledWith('board-1', 'user-456');
    });
  });
});

describe('useListsWithTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
  });

  it('returns empty array when boardId is null', () => {
    const { result } = renderHook(() => useListsWithTasks(null), {
      wrapper: createWrapper(),
    });

    expect(result.current).toEqual([]);
  });
});
