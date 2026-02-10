import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { onSnapshot } from 'firebase/firestore';
import { getUserBoardsQuery } from '../queries/firestoreRefs';
import { createBoard as createBoardService } from '../services/boardService';
import { queryKeys } from '../queries/queryKeys';
import type { Board, CreateBoardInput } from '../types/board';
import { useAuthQuery } from './useAuthQuery';

export const useUserBoardsQuery = () => {
  const { user, isLoading: isAuthLoading } = useAuthQuery();
  const queryClient = useQueryClient();

  // Main boards query
  const { data: boards = [], isLoading } = useQuery<Board[]>({
    queryKey: queryKeys.boards.user(user?.uid ?? ''),
    queryFn: () => [],
    enabled: !!user,
    staleTime: Infinity,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (isAuthLoading || !user) {
      // Clear boards when user logs out
      if (!isAuthLoading && !user) {
        queryClient.setQueryData(queryKeys.boards.user(''), []);
      }
      return;
    }

    const unsubscribe = onSnapshot(
      getUserBoardsQuery(user.uid),
      (snapshot) => {
        const boards = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Board[];
        queryClient.setQueryData(queryKeys.boards.user(user.uid), boards);
      },
      (error) => {
        console.error('Error fetching boards:', error);
      }
    );

    return () => unsubscribe();
  }, [user, isAuthLoading, queryClient]);

  // Create board mutation
  const createBoardMutation = useMutation({
    mutationFn: async (input: CreateBoardInput) => {
      if (!user) throw new Error('Not authenticated');
      return createBoardService(input, user.uid);
    },
    onSuccess: (newBoard) => {
      // Optimistically add the new board to the cache
      queryClient.setQueryData<Board[]>(
        queryKeys.boards.user(user?.uid ?? ''),
        (old = []) => [newBoard, ...old]
      );
    },
  });

  const createBoard = async (input: CreateBoardInput) => {
    return createBoardMutation.mutateAsync(input);
  };

  return {
    boards,
    isLoading: isLoading || isAuthLoading,
    error: null,
    createBoard,
  };
};
