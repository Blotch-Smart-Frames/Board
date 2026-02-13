export const queryKeys = {
  auth: ['auth'] as const,
  boards: {
    all: ['boards'] as const,
    user: (userId: string) => ['boards', 'user', userId] as const,
    detail: (boardId: string) => ['boards', 'detail', boardId] as const,
    lists: (boardId: string) => ['boards', boardId, 'lists'] as const,
    tasks: (boardId: string) => ['boards', boardId, 'tasks'] as const,
    labels: (boardId: string) => ['boards', boardId, 'labels'] as const,
    sprints: (boardId: string) => ['boards', boardId, 'sprints'] as const,
  },
  users: {
    all: ['users'] as const,
    byId: (userId: string) => ['users', userId] as const,
    byIds: (userIds: string[]) => ['users', 'batch', ...userIds] as const,
  },
};
