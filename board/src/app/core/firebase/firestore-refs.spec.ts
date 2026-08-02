import type { Firestore } from 'firebase/firestore';
import { taskCommentsQuery, taskHistoryQuery } from './firestore-refs';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({
    type: 'collection',
    path: segments.join('/'),
  })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({
    type: 'query',
    ref,
    constraints,
  })),
  orderBy: vi.fn((field: string, dir?: 'asc' | 'desc') => ({ orderBy: field, dir: dir ?? 'asc' })),
}));

const db = {} as Firestore;

describe('taskCommentsQuery', () => {
  it('targets the comments subcollection under the task', () => {
    const q = taskCommentsQuery(db, 'board-1', 'task-1') as unknown as {
      ref: { path: string };
      constraints: { orderBy: string; dir: string }[];
    };
    expect(q.ref.path).toBe('boards/board-1/tasks/task-1/comments');
  });

  it('orders results by createdAt ascending', () => {
    const q = taskCommentsQuery(db, 'board-1', 'task-1') as unknown as {
      constraints: { orderBy: string; dir: string }[];
    };
    expect(q.constraints).toEqual([{ orderBy: 'createdAt', dir: 'asc' }]);
  });
});

describe('taskHistoryQuery', () => {
  it('targets the history subcollection under the task', () => {
    const q = taskHistoryQuery(db, 'board-1', 'task-1') as unknown as {
      ref: { path: string };
    };
    expect(q.ref.path).toBe('boards/board-1/tasks/task-1/history');
  });

  it('orders results by createdAt descending (newest first)', () => {
    const q = taskHistoryQuery(db, 'board-1', 'task-1') as unknown as {
      constraints: { orderBy: string; dir: string }[];
    };
    expect(q.constraints).toEqual([{ orderBy: 'createdAt', dir: 'desc' }]);
  });
});
