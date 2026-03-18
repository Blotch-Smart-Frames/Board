import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  getUserBoardsQuery,
  getCollaboratorBoardsQuery,
} from '../queries/firestoreRefs';
import { createBoard as createBoardService } from '../services/boardService';
import { setBoardOrder } from '../services/boardOrderService';
import { queryKeys } from '../queries/queryKeys';
import type { Board, CreateBoardInput } from '../types/board';
import { useAuthQuery } from './useAuthQuery';
import { compareOrder, getOrderAtEnd } from '../utils/ordering';

type BoardWithOrder = Board & { order?: string };

const mergeBoards = (
  owned: Board[],
  collaborated: Board[],
  orderMap: Record<string, string>,
): BoardWithOrder[] => {
  const map = new Map<string, BoardWithOrder>();
  for (const b of owned) map.set(b.id, { ...b, order: orderMap[b.id] });
  for (const b of collaborated) {
    if (!map.has(b.id)) map.set(b.id, { ...b, order: orderMap[b.id] });
  }
  return Array.from(map.values()).sort((a, b) =>
    compareOrder(a.order, b.order),
  );
};

export const useUserBoardsQuery = () => {
  const { user, isLoading: isAuthLoading } = useAuthQuery();
  const queryClient = useQueryClient();
  const ownedRef = useRef<Board[]>([]);
  const collaboratedRef = useRef<Board[]>([]);
  const orderMapRef = useRef<Record<string, string>>({});

  // Main boards query
  const { data: boards = [], isLoading } = useQuery<BoardWithOrder[]>({
    queryKey: queryKeys.boards.user(user?.uid ?? ''),
    queryFn: () => [],
    enabled: !!user,
    staleTime: Infinity,
  });

  // Subscribe to real-time updates for owned boards, collaborator boards, and board order
  useEffect(() => {
    if (isAuthLoading || !user) {
      if (!isAuthLoading && !user) {
        ownedRef.current = [];
        collaboratedRef.current = [];
        orderMapRef.current = {};
        queryClient.setQueryData(queryKeys.boards.user(''), []);
      }
      return;
    }

    const updateCache = () => {
      queryClient.setQueryData(
        queryKeys.boards.user(user.uid),
        mergeBoards(
          ownedRef.current,
          collaboratedRef.current,
          orderMapRef.current,
        ),
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

    const unsubOrder = onSnapshot(
      doc(db, 'users', user.uid, 'preferences', 'boardOrder'),
      (snapshot) => {
        orderMapRef.current =
          (snapshot.data()?.boards as Record<string, string>) ?? {};
        updateCache();
      },
      (error) => {
        console.error('Error fetching board order:', error);
      },
    );

    return () => {
      unsubOwned();
      unsubCollaborated();
      unsubOrder();
    };
  }, [user, isAuthLoading, queryClient]);

  // Create board mutation
  const createBoardMutation = useMutation({
    mutationFn: async (input: CreateBoardInput) => {
      if (!user) throw new Error('Not authenticated');
      const board = await createBoardService(input, user.uid);
      const order = getOrderAtEnd(boards);
      await setBoardOrder(user.uid, board.id, order);
      return board;
    },
  });

  const createBoard = async (input: CreateBoardInput) => {
    return createBoardMutation.mutateAsync(input);
  };

  const reorderBoard = async (boardId: string, newOrder: string) => {
    if (!user) return;
    // Optimistic update
    queryClient.setQueryData(
      queryKeys.boards.user(user.uid),
      (old: BoardWithOrder[] | undefined) => {
        if (!old) return old;
        return old
          .map((b) => (b.id === boardId ? { ...b, order: newOrder } : b))
          .sort((a, b) => compareOrder(a.order, b.order));
      },
    );
    await setBoardOrder(user.uid, boardId, newOrder);
  };

  return {
    boards,
    isLoading: isLoading || isAuthLoading,
    error: null,
    createBoard,
    reorderBoard,
  };
};
