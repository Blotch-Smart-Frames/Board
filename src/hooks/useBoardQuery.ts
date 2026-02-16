import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { onSnapshot } from 'firebase/firestore';
import {
  getBoardRef,
  getBoardListsQuery,
  getBoardTasksQuery,
} from '../queries/firestoreRefs';
import {
  addList as addListService,
  updateList as updateListService,
  deleteList as deleteListService,
  addTask as addTaskService,
  updateTask as updateTaskService,
  deleteTask as deleteTaskService,
  moveTask as moveTaskService,
  reorderLists as reorderListsService,
  deleteBoard as deleteBoardService,
  shareBoard as shareBoardService,
} from '../services/boardService';
import { queryKeys } from '../queries/queryKeys';
import type {
  Board,
  List,
  Task,
  CreateListInput,
  CreateTaskInput,
  UpdateListInput,
  UpdateTaskInput,
} from '../types/board';
import { useAuthQuery } from './useAuthQuery';
import { compareOrder } from '../utils/ordering';

export const useBoardQuery = (boardId: string | null) => {
  const { user } = useAuthQuery();
  const queryClient = useQueryClient();

  // Board query
  const { data: board = null } = useQuery<Board | null>({
    queryKey: queryKeys.boards.detail(boardId ?? ''),
    queryFn: () => null,
    enabled: !!boardId,
    staleTime: Infinity,
  });

  // Lists query
  const { data: lists = [] } = useQuery<List[]>({
    queryKey: queryKeys.boards.lists(boardId ?? ''),
    queryFn: () => [],
    enabled: !!boardId,
    staleTime: Infinity,
  });

  // Tasks query
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: queryKeys.boards.tasks(boardId ?? ''),
    queryFn: () => [],
    enabled: !!boardId,
    staleTime: Infinity,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!boardId) {
      return;
    }

    const unsubscribes: (() => void)[] = [];

    // Subscribe to board
    unsubscribes.push(
      onSnapshot(
        getBoardRef(boardId),
        (doc) => {
          if (doc.exists()) {
            queryClient.setQueryData(queryKeys.boards.detail(boardId), {
              ...doc.data(),
              id: doc.id,
            } as Board);
          }
        },
        (error) => {
          console.error('Board subscription error:', error);
        },
      ),
    );

    // Subscribe to lists
    unsubscribes.push(
      onSnapshot(
        getBoardListsQuery(boardId),
        (snapshot) => {
          const lists = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as List[];
          queryClient.setQueryData(queryKeys.boards.lists(boardId), lists);
        },
        (error) => {
          console.error('Lists subscription error:', error);
        },
      ),
    );

    // Subscribe to tasks
    unsubscribes.push(
      onSnapshot(
        getBoardTasksQuery(boardId),
        (snapshot) => {
          const tasks = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as Task[];
          queryClient.setQueryData(queryKeys.boards.tasks(boardId), tasks);
        },
        (error) => {
          console.error('Tasks subscription error:', error);
        },
      ),
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      // Clear data when unmounting
      queryClient.setQueryData(queryKeys.boards.detail(boardId), null);
      queryClient.setQueryData(queryKeys.boards.lists(boardId), []);
      queryClient.setQueryData(queryKeys.boards.tasks(boardId), []);
    };
  }, [boardId, queryClient]);

  // List operations
  const addList = async (input: CreateListInput) => {
    if (!boardId) throw new Error('No board selected');
    return addListService(boardId, input);
  };

  const updateList = async (listId: string, updates: UpdateListInput) => {
    if (!boardId) throw new Error('No board selected');
    return updateListService(boardId, listId, updates);
  };

  const deleteList = async (listId: string) => {
    if (!boardId) throw new Error('No board selected');
    return deleteListService(boardId, listId);
  };

  // Task operations
  const addTask = async (listId: string, input: CreateTaskInput) => {
    if (!boardId || !user)
      throw new Error('No board selected or not authenticated');
    return addTaskService(boardId, listId, input, user.uid);
  };

  const updateTask = async (taskId: string, updates: UpdateTaskInput) => {
    if (!boardId) throw new Error('No board selected');
    return updateTaskService(boardId, taskId, updates);
  };

  const deleteTask = async (taskId: string) => {
    if (!boardId) throw new Error('No board selected');
    return deleteTaskService(boardId, taskId);
  };

  const moveTask = async (
    taskId: string,
    newListId: string,
    newOrder: string,
  ) => {
    if (!boardId) throw new Error('No board selected');
    return moveTaskService(boardId, taskId, newListId, newOrder);
  };

  const reorderLists = async (listId: string, newOrder: string) => {
    if (!boardId) throw new Error('No board selected');
    return reorderListsService(boardId, listId, newOrder);
  };

  // Board operations
  const deleteBoard = async () => {
    if (!boardId) throw new Error('No board selected');
    return deleteBoardService(boardId);
  };

  const shareBoard = async (userId: string) => {
    if (!boardId) throw new Error('No board selected');
    return shareBoardService(boardId, userId);
  };

  // Derived loading state: loading when boardId exists but board data hasn't arrived yet
  const isLoading = !!boardId && !board;

  return {
    board,
    lists,
    tasks,
    isLoading,
    error: null,
    addList,
    updateList,
    deleteList,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    reorderLists,
    deleteBoard,
    shareBoard,
  };
};

// Helper hook to get lists with their tasks (derived state)
export const useListsWithTasks = (boardId: string | null) => {
  const { lists, tasks } = useBoardQuery(boardId);

  return [...lists]
    .sort((a, b) => compareOrder(a.order, b.order))
    .map((list) => ({
      ...list,
      tasks: tasks
        .filter((task) => task.listId === list.id)
        .sort((a, b) => compareOrder(a.order, b.order)),
    }));
};
