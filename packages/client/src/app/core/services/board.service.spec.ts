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
import { FIRESTORE_DB } from '../firebase/firebase.config';
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
    it('captures the board before deleting it, so background cleanup still knows about it', async () => {
      // getBoard() is called first — must resolve with a real board, exists()=true.
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'board-1',
        data: () => ({
          title: 'B',
          ownerId: 'u1',
          collaborators: [],
          backgroundImageUrl: 'bg.png',
        }),
      } as never);

      vi.mocked(getDocs).mockImplementation((ref: unknown) => {
        const path = (ref as { path: string }).path;
        if (path === 'boards/board-1/tasks') {
          return Promise.resolve({
            docs: [
              {
                id: 'task-1',
                ref: collectionRef('boards/board-1/tasks/task-1'),
                data: () => ({ attachments: [{ storagePath: 'att-1' }] }),
              },
            ],
          } as never);
        }
        if (
          path === 'boards/board-1/tasks/task-1/comments' ||
          path === 'boards/board-1/tasks/task-1/history'
        ) {
          return Promise.resolve({ docs: [] } as never);
        }
        return Promise.resolve({ docs: [] } as never); // lists, labels, sprints
      });

      const batch = fakeBatch();
      vi.mocked(writeBatch).mockReturnValue(batch as never);

      await service.deleteBoard('board-1');

      // The board doc itself must be included in the deleted refs.
      expect(batch.delete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'boards/board-1' }),
      );
      // Background image cleanup must fire, proving the pre-delete board data was captured.
      expect(storageService.deleteBoardBackground).toHaveBeenCalledWith('board-1');
      expect(storageService.deleteTaskAttachment).toHaveBeenCalledWith('att-1');
    });

    it('skips background cleanup when the board never had a background image', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'board-1',
        data: () => ({ title: 'B', ownerId: 'u1', collaborators: [] }),
      } as never);
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);
      vi.mocked(writeBatch).mockReturnValue(fakeBatch() as never);

      await service.deleteBoard('board-1');

      expect(storageService.deleteBoardBackground).not.toHaveBeenCalled();
    });

    it('splits deletes into chunks of 500 so no single batch exceeds the Firestore limit', async () => {
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'board-1',
        data: () => ({ title: 'B', ownerId: 'u1', collaborators: [] }),
      } as never);

      const manyLists = Array.from({ length: 750 }, (_, i) => ({
        ref: collectionRef(`list-${i}`),
      }));
      vi.mocked(getDocs).mockImplementation((ref: unknown) => {
        const path = (ref as { path: string }).path;
        if (path === 'boards/board-1/lists') return Promise.resolve({ docs: manyLists } as never);
        return Promise.resolve({ docs: [] } as never);
      });

      const batches = [fakeBatch(), fakeBatch()];
      let call = 0;
      vi.mocked(writeBatch).mockImplementation(() => batches[call++] as never);

      await service.deleteBoard('board-1');

      // 750 lists + 1 board doc = 751 refs -> ceil(751/500) = 2 batch commits.
      expect(batches[0].commit).toHaveBeenCalledTimes(1);
      expect(batches[1].commit).toHaveBeenCalledTimes(1);
      expect(batches[0].delete).toHaveBeenCalledTimes(500);
      expect(batches[1].delete).toHaveBeenCalledTimes(251);
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
        { action: 'completed', userId: 'u1' },
        { action: 'reopened', userId: 'u1' },
      ]);

      expect(batch.set).toHaveBeenCalledTimes(2);
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('migrateTaskToBoard', () => {
    it('rejects a migration to the same board without touching Firestore', async () => {
      await expect(
        service.migrateTaskToBoard('board-1', 'task-1', 'board-1', 'list-x', 'u1', {
          fromBoardName: 'A',
          toBoardName: 'A',
        }),
      ).rejects.toThrow(/same board/i);

      expect(getDoc).not.toHaveBeenCalled();
      expect(writeBatch).not.toHaveBeenCalled();
    });

    it('copies the task, its comments and history, appends a board_migrated entry, and deletes the source', async () => {
      const batch = fakeBatch();
      vi.mocked(writeBatch).mockReturnValue(batch as never);
      // The real `doc(collection)` call generates an auto-id we later read via
      // `.id`; the shared mock only returns `{ path }`, so extend it for this
      // scope to include an id.
      let autoIdCounter = 0;
      vi.mocked(doc).mockImplementation((_ref: unknown, ...segments: string[]) => {
        const id = segments.length > 0 ? segments[segments.length - 1] : `auto-${autoIdCounter++}`;
        return { path: segments.join('/'), id } as never;
      });
      // Source task read.
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          listId: 'list-src',
          title: 'Move me',
          description: 'D',
          order: 'a0',
          startDate: null,
          dueDate: null,
          calendarSyncEnabled: false,
          createdBy: 'u1',
          assignedTo: ['u2'],
          labelIds: ['l1'],
          color: '#fff',
          attachments: [],
          commentCount: 1,
          createdAt: { seconds: 1 },
          updatedAt: { seconds: 2 },
        }),
      } as never);
      // Comments, history, target-list tasks reads.
      vi.mocked(getDocs)
        .mockResolvedValueOnce({
          docs: [{ id: 'c1', data: () => ({ text: 'Hi' }), ref: { path: 'c1' } }],
        } as never)
        .mockResolvedValueOnce({
          docs: [{ id: 'h1', data: () => ({ action: 'completed' }), ref: { path: 'h1' } }],
        } as never)
        .mockResolvedValueOnce({ docs: [] } as never);

      const newId = await service.migrateTaskToBoard(
        'board-1',
        'task-1',
        'board-2',
        'list-dst',
        'u1',
        { fromBoardName: 'Source', toBoardName: 'Target' },
      );

      expect(typeof newId).toBe('string');

      // The new task, the copied comment, the copied history entry, and the
      // migration entry all go through the first batch.set.
      expect(batch.set).toHaveBeenCalledTimes(4);
      // Target task is written without labels (source-board scoped) and inherits assignees.
      const firstSetPayload = batch.set.mock.calls[0][1];
      expect(firstSetPayload).toMatchObject({
        listId: 'list-dst',
        title: 'Move me',
        assignedTo: ['u2'],
        labelIds: [],
      });
      expect(firstSetPayload).not.toHaveProperty('sprintId');
      // Migration history entry is one of the batch.set calls.
      const migrationEntry = batch.set.mock.calls.find(
        (c) => (c[1] as { action?: string }).action === 'board_migrated',
      );
      expect(migrationEntry).toBeDefined();
      expect(migrationEntry![1]).toMatchObject({
        action: 'board_migrated',
        userId: 'u1',
        metadata: { fromBoardName: 'Source', toBoardName: 'Target' },
      });

      // Two batches commit: one for writes, one for the source-side deletes.
      expect(batch.commit).toHaveBeenCalledTimes(2);
    });

    it('throws when the source task no longer exists', async () => {
      vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);

      await expect(
        service.migrateTaskToBoard('board-1', 'gone', 'board-2', 'list', 'u1', {
          fromBoardName: 'A',
          toBoardName: 'B',
        }),
      ).rejects.toThrow(/task not found/i);
    });
  });
});
