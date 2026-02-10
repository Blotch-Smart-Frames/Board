export const queryKeys = {
  auth: ['auth'] as const,
  boards: {
    all: ['boards'] as const,
    user: (userId: string) => ['boards', 'user', userId] as const,
    detail: (boardId: string) => ['boards', 'detail', boardId] as const,
    lists: (boardId: string) => ['boards', boardId, 'lists'] as const,
    tasks: (boardId: string) => ['boards', boardId, 'tasks'] as const,
    labels: (boardId: string) => ['boards', boardId, 'labels'] as const,
  },
};
