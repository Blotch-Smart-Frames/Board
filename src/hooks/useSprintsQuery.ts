import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { onSnapshot } from 'firebase/firestore';
import { getBoardSprintsQuery } from '../queries/firestoreRefs';
import {
  createSprint as createSprintService,
  updateSprint as updateSprintService,
  deleteSprint as deleteSprintService,
  canDeleteSprint as canDeleteSprintService,
  calculateNextSprintDates as calculateNextSprintDatesService,
  updateSprintConfig as updateSprintConfigService,
} from '../services/sprintService';
import { queryKeys } from '../queries/queryKeys';
import type {
  Sprint,
  CreateSprintInput,
  UpdateSprintInput,
  SprintConfig,
} from '../types/board';

export const useSprintsQuery = (boardId: string | null) => {
  const queryClient = useQueryClient();

  // Sprints query
  const { data: sprints = [], isLoading } = useQuery<Sprint[]>({
    queryKey: queryKeys.boards.sprints(boardId ?? ''),
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
      getBoardSprintsQuery(boardId),
      (snapshot) => {
        const sprintsData = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Sprint[];
        queryClient.setQueryData(
          queryKeys.boards.sprints(boardId),
          sprintsData,
        );
      },
      (error) => {
        console.error('Sprints subscription error:', error);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [boardId, queryClient]);

  const createSprint = async (input: CreateSprintInput) => {
    if (!boardId) throw new Error('No board selected');
    return createSprintService(boardId, input);
  };

  const updateSprint = async (sprintId: string, updates: UpdateSprintInput) => {
    if (!boardId) throw new Error('No board selected');
    return updateSprintService(boardId, sprintId, updates);
  };

  const deleteSprint = async (sprintId: string) => {
    if (!boardId) throw new Error('No board selected');
    return deleteSprintService(boardId, sprintId);
  };

  const canDeleteSprint = async (sprintId: string) => {
    if (!boardId) throw new Error('No board selected');
    return canDeleteSprintService(boardId, sprintId);
  };

  const calculateNextSprintDates = async () => {
    if (!boardId) throw new Error('No board selected');
    return calculateNextSprintDatesService(boardId);
  };

  const updateSprintConfig = async (config: SprintConfig) => {
    if (!boardId) throw new Error('No board selected');
    return updateSprintConfigService(boardId, config);
  };

  return {
    sprints,
    isLoading,
    createSprint,
    updateSprint,
    deleteSprint,
    canDeleteSprint,
    calculateNextSprintDates,
    updateSprintConfig,
  };
};
