import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { onSnapshot } from 'firebase/firestore';
import { getBoardLabelsQuery } from '../queries/firestoreRefs';
import {
  createLabel as createLabelService,
  updateLabel as updateLabelService,
  deleteLabel as deleteLabelService,
  initializeDefaultLabels as initializeDefaultLabelsService,
} from '../services/labelService';
import { queryKeys } from '../queries/queryKeys';
import type { Label, CreateLabelInput, UpdateLabelInput } from '../types/board';

export const useLabelsQuery = (boardId: string | null) => {
  const queryClient = useQueryClient();

  // Labels query
  const { data: labels = [], isLoading } = useQuery<Label[]>({
    queryKey: queryKeys.boards.labels(boardId ?? ''),
    queryFn: () => [],
    enabled: !!boardId,
    staleTime: Infinity,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!boardId) {
      return;
    }

    const unsubscribe = onSnapshot(
      getBoardLabelsQuery(boardId),
      (snapshot) => {
        const labelsData = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Label[];
        queryClient.setQueryData(queryKeys.boards.labels(boardId), labelsData);
      },
      (error) => {
        console.error('Labels subscription error:', error);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [boardId, queryClient]);

  const createLabel = async (input: CreateLabelInput) => {
    if (!boardId) throw new Error('No board selected');
    return createLabelService(boardId, input);
  };

  const updateLabel = async (labelId: string, updates: UpdateLabelInput) => {
    if (!boardId) throw new Error('No board selected');
    return updateLabelService(boardId, labelId, updates);
  };

  const deleteLabel = async (labelId: string) => {
    if (!boardId) throw new Error('No board selected');
    return deleteLabelService(boardId, labelId);
  };

  const initializeDefaultLabels = async () => {
    if (!boardId) throw new Error('No board selected');
    return initializeDefaultLabelsService(boardId);
  };

  return {
    labels,
    isLoading,
    createLabel,
    updateLabel,
    deleteLabel,
    initializeDefaultLabels,
  };
};
