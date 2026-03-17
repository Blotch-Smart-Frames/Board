import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { onSnapshot } from 'firebase/firestore';
import { getTaskHistoryQuery } from '../queries/firestoreRefs';
import { queryKeys } from '../queries/queryKeys';
import type { HistoryEntry } from '../types/board';

export const useHistoryQuery = (boardId: string, taskId: string) => {
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery<HistoryEntry[]>({
    queryKey: queryKeys.boards.history(boardId, taskId),
    queryFn: () => [],
    enabled: !!boardId && !!taskId,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!boardId || !taskId) {
      return;
    }

    const unsubscribe = onSnapshot(
      getTaskHistoryQuery(boardId, taskId),
      (snapshot) => {
        const historyData = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as HistoryEntry[];
        queryClient.setQueryData(
          queryKeys.boards.history(boardId, taskId),
          historyData,
        );
      },
      (error) => {
        console.error('History subscription error:', error);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [boardId, taskId, queryClient]);

  return { history, isLoading };
};
