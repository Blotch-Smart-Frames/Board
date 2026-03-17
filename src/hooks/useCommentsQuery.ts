import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { onSnapshot } from 'firebase/firestore';
import { getTaskCommentsQuery } from '../queries/firestoreRefs';
import {
  addComment as addCommentService,
  updateComment as updateCommentService,
  deleteComment as deleteCommentService,
} from '../services/boardService';
import { useAuthQuery } from './useAuthQuery';
import { queryKeys } from '../queries/queryKeys';
import type {
  Comment,
  CreateCommentInput,
  UpdateCommentInput,
} from '../types/board';

export const useCommentsQuery = (boardId: string, taskId: string) => {
  const queryClient = useQueryClient();
  const { user } = useAuthQuery();

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: queryKeys.boards.comments(boardId, taskId),
    queryFn: () => [],
    enabled: !!boardId && !!taskId,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!boardId || !taskId) {
      return;
    }

    const unsubscribe = onSnapshot(
      getTaskCommentsQuery(boardId, taskId),
      (snapshot) => {
        const commentsData = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Comment[];
        queryClient.setQueryData(
          queryKeys.boards.comments(boardId, taskId),
          commentsData,
        );
      },
      (error) => {
        console.error('Comments subscription error:', error);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [boardId, taskId, queryClient]);

  const addComment = async (input: CreateCommentInput) => {
    if (!user) throw new Error('Not authenticated');
    return addCommentService(boardId, taskId, input, user.uid);
  };

  const updateComment = async (
    commentId: string,
    updates: UpdateCommentInput,
  ) => {
    return updateCommentService(boardId, taskId, commentId, updates);
  };

  const deleteComment = async (commentId: string) => {
    return deleteCommentService(boardId, taskId, commentId);
  };

  return {
    comments,
    isLoading,
    addComment,
    updateComment,
    deleteComment,
  };
};
