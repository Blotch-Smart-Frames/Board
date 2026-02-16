import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { onSnapshot } from 'firebase/firestore';
import {
  getUserBoardsQuery,
  getCollaboratorBoardsQuery,
} from '../queries/firestoreRefs';
import { createBoard as createBoardService } from '../services/boardService';
import { queryKeys } from '../queries/queryKeys';
import type { Board, CreateBoardInput } from '../types/board';
import { useAuthQuery } from './useAuthQuery';

const mergeBoards = (owned: Board[], collaborated: Board[]): Board[] => {
  const map = new Map<string, Board>();
  for (const b of owned) map.set(b.id, b);
  for (const b of collaborated) {
    if (!map.has(b.id)) map.set(b.id, b);
  }
  return Array.from(map.values());
};

export const useUserBoardsQuery = () => {
  const { user, isLoading: isAuthLoading } = useAuthQuery();
  const queryClient = useQueryClient();
  const ownedRef = useRef<Board[]>([]);
  const collaboratedRef = useRef<Board[]>([]);

  // Main boards query
  const { data: boards = [], isLoading } = useQuery<Board[]>({
    queryKey: queryKeys.boards.user(user?.uid ?? ''),
    queryFn: () => [],
    enabled: !!user,
    staleTime: Infinity,
  });

  // Subscribe to real-time updates for both owned and collaborator boards
  useEffect(() => {
    if (isAuthLoading || !user) {
      // Clear boards when user logs out
      if (!isAuthLoading && !user) {
        ownedRef.current = [];
        collaboratedRef.current = [];
        queryClient.setQueryData(queryKeys.boards.user(''), []);
      }
      return;
    }

    const updateCache = () => {
      queryClient.setQueryData(
        queryKeys.boards.user(user.uid),
        mergeBoards(ownedRef.current, collaboratedRef.current),
      );
    };

    const unsubOwned = onSnapshot(
      getUserBoardsQuery(user.uid),
      (snapshot) => {
        ownedRef.current = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Board[];
        updateCache();
      },
      (error) => {
        console.error('Error fetching owned boards:', error);
      },
    );

    const unsubCollaborated = onSnapshot(
      getCollaboratorBoardsQuery(user.uid),
      (snapshot) => {
        collaboratedRef.current = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Board[];
        updateCache();
      },
      (error) => {
        console.error('Error fetching collaborator boards:', error);
      },
    );

    return () => {
      unsubOwned();
      unsubCollaborated();
    };
  }, [user, isAuthLoading, queryClient]);

  // Create board mutation
  const createBoardMutation = useMutation({
    mutationFn: async (input: CreateBoardInput) => {
      if (!user) throw new Error('Not authenticated');
      return createBoardService(input, user.uid);
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
