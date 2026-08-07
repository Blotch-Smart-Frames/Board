import { TestBed } from '@angular/core/testing';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  updateDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FIREBASE_FUNCTIONS, FIRESTORE_DB } from '../firebase/firebase.config';
import { LabelService } from './label.service';
import { StorageService } from './storage.service';
import { BoardService } from './board.service';

function fakeBatch() {
  return {
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
}

function collectionRef(path: string) {
  return { path };
}

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  doc: vi.fn((_collectionOrDb: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn((collectionRef: unknown, ...constraints: unknown[]) => ({
    collectionRef,
    constraints,
  })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  writeBatch: vi.fn(),
  increment: vi.fn((n: number) => ({ __increment: n })),
  arrayUnion: vi.fn((v: unknown) => ({ __arrayUnion: v })),
  arrayRemove: vi.fn((v: unknown) => ({ __arrayRemove: v })),
  Timestamp: {
    fromDate: vi.fn((date: Date) => ({ __timestamp: date.getTime(), toDate: () => date })),
  },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));

describe('BoardService', () => {
  let service: BoardService;
  let labelService: { initializeDefaultLabels: ReturnType<typeof vi.fn> };
  let storageService: {
    deleteBoardBackground: ReturnType<typeof vi.fn>;
    deleteTaskAttachment: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    labelService = { initializeDefaultLabels: vi.fn().mockResolvedValue([]) };
    storageService = {
      deleteBoardBackground: vi.fn().mockResolvedValue(undefined),
      deleteTaskAttachment: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE_DB, useValue: {} },
        { provide: FIREBASE_FUNCTIONS, useValue: { __fake: 'functions' } },
        { provide: LabelService, useValue: labelService },
        { provide: StorageService, useValue: storageService },
      ],
    });
    service = TestBed.inject(BoardService);
  });

  describe('createBoard', () => {
    it('creates the board doc and seeds default labels', async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: 'board-1' } as never);
      vi.mocked(getDoc).mockResolvedValue({
        id: 'board-1',
        data: () => ({ title: 'New board', ownerId: 'u1', collaborators: [] }),
      } as never);

      const board = await service.createBoard({ title: 'New board' }, 'u1');

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ title: 'New board', ownerId: 'u1', collaborators: [] }),
      );
      expect(labelService.initializeDefaultLabels).toHaveBeenCalledWith('board-1');
      expect(board.id).toBe('board-1');
    });
  });

  describe('getBoard', () => {
    it('returns null for a missing board', async () => {
      vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
      expect(await service.getBoard('missing')).toBeNull();
    });
  });

  describe('deleteBoard', () => {
    it('deletes only the board doc — the cascade is handled by the cleanup Cloud Function', async () => {
      await service.deleteBoard('board-1');

      expect(deleteDoc).toHaveBeenCalledTimes(1);
      expect(deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'boards/board-1' }));
    });

    it('does no client-side cascade: no subcollection reads, batches, or storage cleanup', async () => {
      await service.deleteBoard('board-1');

      expect(getDoc).not.toHaveBeenCalled();
      expect(getDocs).not.toHaveBeenCalled();
      expect(writeBatch).not.toHaveBeenCalled();
      expect(storageService.deleteBoardBackground).not.toHaveBeenCalled();
      expect(storageService.deleteTaskAttachment).not.toHaveBeenCalled();
    });
  });

  describe('shareBoard', () => {
    it('throws when the board does not exist', async () => {
      vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);

      await expect(service.shareBoard('missing', 'u2')).rejects.toThrow('Board not found');
    });

    it('adds a new collaborator atomically', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        id: 'board-1',
        data: () => ({ ownerId: 'u1', collaborators: [] }),
      } as never);

      await service.shareBoard('board-1', 'u2');

      expect(arrayUnion).toHaveBeenCalledWith('u2');
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        collaborators: { __arrayUnion: 'u2' },
      });
    });

    it('does not write again if the user is already a collaborator', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        id: 'board-1',
        data: () => ({ ownerId: 'u1', collaborators: ['u2'] }),
      } as never);

      await service.shareBoard('board-1', 'u2');

      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('removeCollaborator', () => {
    it('removes the user atomically from the collaborators array', async () => {
      await service.removeCollaborator('board-1', 'u2');

      expect(arrayRemove).toHaveBeenCalledWith('u2');
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        collaborators: { __arrayRemove: 'u2' },
        updatedAt: 'SERVER_TIMESTAMP',
      });
    });
  });

  describe('addTask', () => {
    it('fills in defaults for optional fields and converts dates to Timestamps', async () => {
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);
      vi.mocked(addDoc).mockResolvedValue({ id: 'task-1' } as never);
      vi.mocked(getDoc).mockResolvedValue({ id: 'task-1', data: () => ({ title: 'T' }) } as never);

      const dueDate = new Date('2026-06-01');
      await service.addTask('board-1', 'list-1', { title: 'T', dueDate }, 'u1');

      const [, payload] = vi.mocked(addDoc).mock.calls[0];
      expect(payload).toMatchObject({
        listId: 'list-1',
        title: 'T',
        description: '',
        startDate: null,
        calendarEventId: null,
        calendarSyncEnabled: false,
        createdBy: 'u1',
        assignedTo: [],
        labelIds: [],
        color: null,
        attachments: [],
        commentCount: 0,
      });
      expect(Timestamp.fromDate).toHaveBeenCalledWith(dueDate);
    });
  });

  describe('updateTask', () => {
    it('strips undefined keys, converts date fields, and passes null through unchanged', async () => {
      const dueDate = new Date('2026-07-01');
      await service.updateTask('board-1', 'task-1', {
        title: 'Renamed',
        description: undefined,
        dueDate,
        startDate: null,
        calendarEventId: null,
      });

      const [, payload] = vi.mocked(updateDoc).mock.calls[0];
      expect(payload).toEqual({
        title: 'Renamed',
        dueDate: { __timestamp: dueDate.getTime(), toDate: expect.any(Function) },
        startDate: null,
        calendarEventId: null,
        updatedAt: 'SERVER_TIMESTAMP',
      });
      expect(payload).not.toHaveProperty('description');
    });
  });

  describe('deleteTask', () => {
    it('best-effort deletes every attachment before deleting the task doc', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ attachments: [{ storagePath: 'a1' }, { storagePath: 'a2' }] }),
      } as never);

      await service.deleteTask('board-1', 'task-1');

      expect(storageService.deleteTaskAttachment).toHaveBeenCalledWith('a1');
      expect(storageService.deleteTaskAttachment).toHaveBeenCalledWith('a2');
      expect(deleteDoc).toHaveBeenCalledTimes(1);
    });

    it('still deletes the task doc even when the attachment cleanup rejects', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        data: () => ({ attachments: [{ storagePath: 'a1' }] }),
      } as never);
      storageService.deleteTaskAttachment.mockRejectedValue(new Error('offline'));

      await expect(service.deleteTask('board-1', 'task-1')).resolves.toBeUndefined();

      expect(deleteDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('comments', () => {
    it('addComment writes the comment and increments commentCount atomically', async () => {
      const batch = fakeBatch();
      vi.mocked(writeBatch).mockReturnValue(batch as never);

      await service.addComment('board-1', 'task-1', { text: 'Hi' }, 'u1');

      expect(batch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ text: 'Hi', authorId: 'u1' }),
      );
      expect(increment).toHaveBeenCalledWith(1);
      expect(batch.update).toHaveBeenCalledWith(expect.anything(), {
        commentCount: { __increment: 1 },
      });
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });

    it('deleteComment removes the comment and decrements commentCount atomically', async () => {
      const batch = fakeBatch();
      vi.mocked(writeBatch).mockReturnValue(batch as never);

      await service.deleteComment('board-1', 'task-1', 'comment-1');

      expect(increment).toHaveBeenCalledWith(-1);
      expect(batch.delete).toHaveBeenCalledTimes(1);
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('addTaskHistory', () => {
    it('is a no-op for an empty entry list', async () => {
      await service.addTaskHistory('board-1', 'task-1', []);

      expect(writeBatch).not.toHaveBeenCalled();
    });

    it('batches every entry in a single commit', async () => {
      const batch = fakeBatch();
      vi.mocked(writeBatch).mockReturnValue(batch as never);

      await service.addTaskHistory('board-1', 'task-1', [
        { action: 'archived', userId: 'u1' },
        { action: 'unarchived', userId: 'u1' },
      ]);

      expect(batch.set).toHaveBeenCalledTimes(2);
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('migrateTaskToBoard', () => {
    it('rejects a migration to the same board without invoking the callable', async () => {
      const call = vi.fn();
      vi.mocked(httpsCallable).mockReturnValue(call as never);

      await expect(
        service.migrateTaskToBoard('board-1', 'task-1', 'board-1', 'list-x', 'u1', {
          fromBoardName: 'A',
          toBoardName: 'A',
        }),
      ).rejects.toThrow(/same board/i);

      expect(httpsCallable).not.toHaveBeenCalled();
      expect(call).not.toHaveBeenCalled();
    });

    it('delegates the migration to the migrateTask Cloud Function', async () => {
      const call = vi.fn().mockResolvedValue({ data: { newTaskId: 'new-id' } });
      vi.mocked(httpsCallable).mockReturnValue(call as never);

      const newId = await service.migrateTaskToBoard(
        'board-1',
        'task-1',
        'board-2',
        'list-dst',
        'u1',
        { fromBoardName: 'Source', toBoardName: 'Target' },
      );

      expect(newId).toBe('new-id');
      // The callable is registered against the injected Functions instance and
      // the deployed function's exported name.
      expect(httpsCallable).toHaveBeenCalledWith({ __fake: 'functions' }, 'migrateTask');
      // Only the four IDs cross the wire — the user id and board titles are
      // resolved server-side from the auth context and freshly-read board docs.
      expect(call).toHaveBeenCalledWith({
        sourceBoardId: 'board-1',
        taskId: 'task-1',
        targetBoardId: 'board-2',
        targetListId: 'list-dst',
      });
    });

    it('propagates errors returned by the callable', async () => {
      const call = vi.fn().mockRejectedValue(new Error('permission-denied'));
      vi.mocked(httpsCallable).mockReturnValue(call as never);

      await expect(
        service.migrateTaskToBoard('board-1', 'task-1', 'board-2', 'list-dst', 'u1', {
          fromBoardName: 'A',
          toBoardName: 'B',
        }),
      ).rejects.toThrow(/permission-denied/);
    });
  });

  describe('updateBoard', () => {
    it('writes the provided fields plus updatedAt', async () => {
      await service.updateBoard('board-1', { title: 'Renamed', backgroundImageUrl: 'bg.png' });

      expect(updateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'boards/board-1' }), {
        title: 'Renamed',
        backgroundImageUrl: 'bg.png',
        updatedAt: 'SERVER_TIMESTAMP',
      });
    });
  });

  describe('lists', () => {
    it('addList appends a new list with the next order value', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          { data: () => ({ id: 'list-1', order: 'a0' }) },
          { data: () => ({ id: 'list-2', order: 'a1' }) },
        ],
      } as never);
      vi.mocked(addDoc).mockResolvedValue({ id: 'list-3' } as never);
      vi.mocked(getDoc).mockResolvedValue({
        id: 'list-3',
        data: () => ({ title: 'New', order: 'a2' }),
      } as never);

      const list = await service.addList('board-1', { title: 'New' });

      expect(list.id).toBe('list-3');
      expect(addDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'boards/board-1/lists' }),
        expect.objectContaining({ title: 'New', order: expect.any(String) }),
      );
    });

    it('updateList writes only the provided fields', async () => {
      await service.updateList('board-1', 'list-1', { title: 'Renamed' });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'boards/board-1/lists/list-1' }),
        { title: 'Renamed' },
      );
    });

    it('deleteList cascades to every task in the list within one batch', async () => {
      const batch = fakeBatch();
      vi.mocked(writeBatch).mockReturnValue(batch as never);
      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          { ref: collectionRef('boards/board-1/tasks/task-1') },
          { ref: collectionRef('boards/board-1/tasks/task-2') },
        ],
      } as never);

      await service.deleteList('board-1', 'list-1');

      expect(batch.delete).toHaveBeenCalledTimes(3); // 2 tasks + 1 list
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });

    it('reorderLists writes the new order onto the target list', async () => {
      await service.reorderLists('board-1', 'list-1', 'a5');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'boards/board-1/lists/list-1' }),
        { order: 'a5' },
      );
    });
  });

  describe('moveTask', () => {
    it('writes the new listId, order, and an updatedAt server timestamp', async () => {
      await service.moveTask('board-1', 'task-1', 'list-2', 'b0');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'boards/board-1/tasks/task-1' }),
        { listId: 'list-2', order: 'b0', updatedAt: 'SERVER_TIMESTAMP' },
      );
    });

    it('includes the archive flag and stamps archivedAt in the same write when archiving', async () => {
      await service.moveTask('board-1', 'task-1', 'list-2', 'b0', true);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'boards/board-1/tasks/task-1' }),
        {
          listId: 'list-2',
          order: 'b0',
          archive: true,
          archivedAt: 'SERVER_TIMESTAMP',
          updatedAt: 'SERVER_TIMESTAMP',
        },
      );
    });

    it('clears archivedAt when unarchiving', async () => {
      await service.moveTask('board-1', 'task-1', 'list-2', 'b0', false);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'boards/board-1/tasks/task-1' }),
        {
          listId: 'list-2',
          order: 'b0',
          archive: false,
          archivedAt: null,
          updatedAt: 'SERVER_TIMESTAMP',
        },
      );
    });
  });

  describe('updateComment', () => {
    it('writes the new text plus an updatedAt server timestamp', async () => {
      await service.updateComment('board-1', 'task-1', 'comment-1', { text: 'Fixed' });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'boards/board-1/tasks/task-1/comments/comment-1' }),
        { text: 'Fixed', updatedAt: 'SERVER_TIMESTAMP' },
      );
    });
  });

  describe('addTask defaults', () => {
    it('serializes both startDate and dueDate when provided', async () => {
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);
      vi.mocked(addDoc).mockResolvedValue({ id: 'task-1' } as never);
      vi.mocked(getDoc).mockResolvedValue({ id: 'task-1', data: () => ({}) } as never);

      const startDate = new Date('2026-06-01');
      const dueDate = new Date('2026-06-07');
      await service.addTask('board-1', 'list-1', { title: 'T', startDate, dueDate }, 'u1');

      const [, payload] = vi.mocked(addDoc).mock.calls[0];
      expect((payload as { startDate: unknown }).startDate).toEqual({
        __timestamp: startDate.getTime(),
        toDate: expect.any(Function),
      });
      expect((payload as { dueDate: unknown }).dueDate).toEqual({
        __timestamp: dueDate.getTime(),
        toDate: expect.any(Function),
      });
    });

    it('stores null for both dates when neither is provided', async () => {
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);
      vi.mocked(addDoc).mockResolvedValue({ id: 'task-1' } as never);
      vi.mocked(getDoc).mockResolvedValue({ id: 'task-1', data: () => ({}) } as never);

      await service.addTask('board-1', 'list-1', { title: 'T' }, 'u1');

      const [, payload] = vi.mocked(addDoc).mock.calls[0];
      expect(payload).toMatchObject({ startDate: null, dueDate: null });
    });
  });

  describe('updateTask edge cases', () => {
    it('passes non-date fields with a null value through unchanged (not through Timestamp.fromDate)', async () => {
      await service.updateTask('board-1', 'task-1', { color: null });

      const [, payload] = vi.mocked(updateDoc).mock.calls[0];
      expect(payload).toEqual({ color: null, updatedAt: 'SERVER_TIMESTAMP' });
      expect(Timestamp.fromDate).not.toHaveBeenCalled();
    });
  });
});
