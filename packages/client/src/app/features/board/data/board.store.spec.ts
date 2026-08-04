import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { FIRESTORE_DB } from '../../../core/firebase/firebase.config';
import { AuthStore } from '../../../core/auth/auth.store';
import { BoardService } from '../../../core/services/board.service';
import { SyncService } from '../../../core/services/sync.service';
import { UserService } from '../../../core/services/user.service';
import { BoardStore } from './board.store';

type SnapshotCallback = (snapshot: unknown) => void;

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({
    type: 'collection',
    path: segments.join('/'),
  })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'doc', path: segments.join('/') })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ type: 'query', ref, constraints })),
  orderBy: vi.fn((field: string) => ({ orderBy: field })),
  onSnapshot: vi.fn(),
}));

function docSnapshot(id: string, data: Record<string, unknown> | undefined) {
  return { exists: () => data !== undefined, id, data: () => data };
}

function collectionSnapshot(docs: { id: string; data: Record<string, unknown> }[]) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

describe('BoardStore', () => {
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let onSnapshotCallbacks: Map<string, SnapshotCallback>;
  let boardService: {
    addList: ReturnType<typeof vi.fn>;
    updateList: ReturnType<typeof vi.fn>;
    deleteList: ReturnType<typeof vi.fn>;
    reorderLists: ReturnType<typeof vi.fn>;
    addTask: ReturnType<typeof vi.fn>;
    updateTask: ReturnType<typeof vi.fn>;
    deleteTask: ReturnType<typeof vi.fn>;
    moveTask: ReturnType<typeof vi.fn>;
    migrateTaskToBoard: ReturnType<typeof vi.fn>;
    addTaskHistory: ReturnType<typeof vi.fn>;
  };
  let syncService: {
    syncTaskToCalendar: ReturnType<typeof vi.fn>;
    unlinkTaskFromCalendar: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    paramMap$ = new BehaviorSubject(convertToParamMap({ boardId: 'board-1' }));
    onSnapshotCallbacks = new Map();
    boardService = {
      addList: vi.fn().mockResolvedValue({ id: 'list-new' }),
      updateList: vi.fn().mockResolvedValue(undefined),
      deleteList: vi.fn().mockResolvedValue(undefined),
      reorderLists: vi.fn().mockResolvedValue(undefined),
      addTask: vi.fn().mockResolvedValue({ id: 'task-new' }),
      updateTask: vi.fn().mockResolvedValue(undefined),
      deleteTask: vi.fn().mockResolvedValue(undefined),
      moveTask: vi.fn().mockResolvedValue(undefined),
      migrateTaskToBoard: vi.fn().mockResolvedValue('task-new-id'),
      addTaskHistory: vi.fn().mockResolvedValue(undefined),
    };
    syncService = {
      syncTaskToCalendar: vi.fn().mockResolvedValue(null),
      unlinkTaskFromCalendar: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(onSnapshot).mockImplementation((ref: unknown, onNext: unknown) => {
      const path =
        (ref as { path?: string; ref?: { path: string } }).path ??
        (ref as { ref: { path: string } }).ref.path;
      onSnapshotCallbacks.set(path, onNext as SnapshotCallback);
      return vi.fn(); // unsubscribe
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE_DB, useValue: {} },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$ } },
        { provide: AuthStore, useValue: { user: signal({ uid: 'u1' }) } },
        { provide: BoardService, useValue: boardService },
        { provide: SyncService, useValue: syncService },
        { provide: UserService, useValue: { getUsersByIds: vi.fn().mockResolvedValue([]) } },
        BoardStore,
      ],
    });
  });

  it('reads boardId from the active route and builds board/lists/tasks/labels/sprints refs from it', () => {
    const store = TestBed.inject(BoardStore);
    TestBed.flushEffects();

    expect(store.boardId()).toBe('board-1');
    expect(doc).toHaveBeenCalledWith({}, 'boards', 'board-1');
    expect(collection).toHaveBeenCalledWith({}, 'boards', 'board-1', 'lists');
    expect(collection).toHaveBeenCalledWith({}, 'boards', 'board-1', 'tasks');
    expect(collection).toHaveBeenCalledWith({}, 'boards', 'board-1', 'labels');
    expect(collection).toHaveBeenCalledWith({}, 'boards', 'board-1', 'sprints');
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ path: 'boards/board-1/lists' }), {
      orderBy: 'order',
    });
  });

  it('reflects live snapshot data through the exposed signals', () => {
    const store = TestBed.inject(BoardStore);
    TestBed.flushEffects();

    onSnapshotCallbacks.get('boards/board-1')!(docSnapshot('board-1', { title: 'My board' }));
    onSnapshotCallbacks.get('boards/board-1/tasks')!(
      collectionSnapshot([{ id: 'task-1', data: { title: 'Task 1' } }]),
    );

    expect(store.board()).toEqual({ id: 'board-1', title: 'My board' });
    expect(store.tasks()).toEqual([{ id: 'task-1', title: 'Task 1' }]);
  });

  it('reports isLoading while a board is selected but its first snapshot has not arrived', () => {
    const store = TestBed.inject(BoardStore);
    TestBed.flushEffects();

    expect(store.isLoading()).toBe(true);

    onSnapshotCallbacks.get('boards/board-1')!(docSnapshot('board-1', { title: 'My board' }));

    expect(store.isLoading()).toBe(false);
  });

  it('is not loading when no board is selected at all', () => {
    paramMap$.next(convertToParamMap({}));
    const store = TestBed.inject(BoardStore);
    TestBed.flushEffects();

    expect(store.boardId()).toBeNull();
    expect(store.isLoading()).toBe(false);
    expect(store.board()).toBeNull();
  });

  it('clears to undefined immediately when switching boards, before the new snapshot arrives', () => {
    const store = TestBed.inject(BoardStore);
    TestBed.flushEffects();
    onSnapshotCallbacks.get('boards/board-1')!(docSnapshot('board-1', { title: 'Board One' }));
    expect(store.board()).toEqual({ id: 'board-1', title: 'Board One' });

    paramMap$.next(convertToParamMap({ boardId: 'board-2' }));
    TestBed.flushEffects();

    expect(store.board()).toBeUndefined();

    onSnapshotCallbacks.get('boards/board-2')!(docSnapshot('board-2', { title: 'Board Two' }));
    expect(store.board()).toEqual({ id: 'board-2', title: 'Board Two' });
  });

  describe('listsWithTasks', () => {
    it('sorts lists by order and groups each list’s tasks (also order-sorted)', () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();

      onSnapshotCallbacks.get('boards/board-1/lists')!(
        collectionSnapshot([
          { id: 'list-b', data: { title: 'B', order: 'a1' } },
          { id: 'list-a', data: { title: 'A', order: 'a0' } },
        ]),
      );
      onSnapshotCallbacks.get('boards/board-1/tasks')!(
        collectionSnapshot([
          { id: 't2', data: { listId: 'list-a', order: 'a1' } },
          { id: 't1', data: { listId: 'list-a', order: 'a0' } },
          { id: 't3', data: { listId: 'list-b', order: 'a0' } },
        ]),
      );

      const result = store.listsWithTasks();
      expect(result.map((l) => l.id)).toEqual(['list-a', 'list-b']);
      expect(result[0].tasks.map((t) => t.id)).toEqual(['t1', 't2']);
      expect(result[1].tasks.map((t) => t.id)).toEqual(['t3']);
    });
  });

  describe('filtering', () => {
    function seedForFilters() {
      onSnapshotCallbacks.get('boards/board-1/lists')!(
        collectionSnapshot([{ id: 'list-a', data: { title: 'A', order: 'a0' } }]),
      );
      onSnapshotCallbacks.get('boards/board-1/tasks')!(
        collectionSnapshot([
          {
            id: 't1',
            data: { listId: 'list-a', order: 'a0', assignedTo: ['u1'], labelIds: ['l1'] },
          },
          {
            id: 't2',
            data: { listId: 'list-a', order: 'a1', assignedTo: ['u2'], labelIds: ['l2'] },
          },
          { id: 't3', data: { listId: 'list-a', order: 'a2' } },
        ]),
      );
    }

    it('shows all tasks when no filters are set', () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      seedForFilters();

      expect(store.listsWithTasks()[0].tasks.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    });

    it('assigneeFilter narrows tasks to those assigned to the selected user', () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      seedForFilters();

      store.assigneeFilter.set('u1');

      expect(store.listsWithTasks()[0].tasks.map((t) => t.id)).toEqual(['t1']);
    });

    it('labelFilter narrows tasks to those with any selected label', () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      seedForFilters();

      store.labelFilter.set(['l2']);

      expect(store.listsWithTasks()[0].tasks.map((t) => t.id)).toEqual(['t2']);
    });

    it('combines assigneeFilter and labelFilter with AND semantics', () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      seedForFilters();

      store.assigneeFilter.set('u2');
      store.labelFilter.set(['l1']);

      expect(store.listsWithTasks()[0].tasks).toEqual([]);
    });
  });

  describe('mutations', () => {
    it('addTask includes the current user id', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();

      await store.addTask('list-1', { title: 'New task' });

      expect(boardService.addTask).toHaveBeenCalledWith(
        'board-1',
        'list-1',
        { title: 'New task' },
        'u1',
      );
    });

    it('updateTask records field-change history for a known task', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      onSnapshotCallbacks.get('boards/board-1/tasks')!(
        collectionSnapshot([{ id: 't1', data: { title: 'Old', listId: 'list-1' } }]),
      );

      await store.updateTask('t1', { title: 'New' });

      expect(boardService.updateTask).toHaveBeenCalledWith('board-1', 't1', { title: 'New' });
      expect(boardService.addTaskHistory).toHaveBeenCalledWith(
        'board-1',
        't1',
        expect.arrayContaining([
          expect.objectContaining({ action: 'field_changed', field: 'title' }),
        ]),
      );
    });

    it('setTaskCompleted writes completedAt and a completed history entry', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      onSnapshotCallbacks.get('boards/board-1/tasks')!(
        collectionSnapshot([{ id: 't1', data: { title: 'X', listId: 'list-1' } }]),
      );

      await store.setTaskCompleted('t1', true);

      expect(boardService.updateTask).toHaveBeenCalledWith(
        'board-1',
        't1',
        expect.objectContaining({ completedAt: expect.any(Date) }),
      );
      expect(boardService.addTaskHistory).toHaveBeenCalledWith('board-1', 't1', [
        { action: 'completed', userId: 'u1' },
      ]);
    });

    it('moveTask logs a moved entry when the list changes', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      onSnapshotCallbacks.get('boards/board-1/lists')!(
        collectionSnapshot([
          { id: 'list-1', data: { title: 'To Do', order: 'a0' } },
          { id: 'list-2', data: { title: 'Done', order: 'a1' } },
        ]),
      );
      onSnapshotCallbacks.get('boards/board-1/tasks')!(
        collectionSnapshot([{ id: 't1', data: { title: 'X', listId: 'list-1', order: 'a0' } }]),
      );

      await store.moveTask('t1', 'list-2', 'a5');

      expect(boardService.addTaskHistory).toHaveBeenCalledWith('board-1', 't1', [
        expect.objectContaining({
          action: 'moved',
          metadata: { fromListName: 'To Do', toListName: 'Done' },
        }),
      ]);
      expect(boardService.moveTask).toHaveBeenCalledWith('board-1', 't1', 'list-2', 'a5');
    });

    it('moveTaskToList appends the task to the end of the destination list and logs history', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      onSnapshotCallbacks.get('boards/board-1/lists')!(
        collectionSnapshot([
          { id: 'list-1', data: { title: 'To Do', order: 'a0' } },
          { id: 'list-2', data: { title: 'Done', order: 'a1' } },
        ]),
      );
      onSnapshotCallbacks.get('boards/board-1/tasks')!(
        collectionSnapshot([
          { id: 't1', data: { title: 'X', listId: 'list-1', order: 'a0' } },
          { id: 't2', data: { title: 'Y', listId: 'list-2', order: 'a0' } },
        ]),
      );

      await store.moveTaskToList('t1', 'list-2');

      const [, taskId, destListId, order] = boardService.moveTask.mock.calls[0];
      expect(taskId).toBe('t1');
      expect(destListId).toBe('list-2');
      expect(order > 'a0').toBe(true); // placed after t2, i.e. appended at the end
      expect(boardService.addTaskHistory).toHaveBeenCalledWith('board-1', 't1', [
        expect.objectContaining({
          action: 'moved',
          metadata: { fromListName: 'To Do', toListName: 'Done' },
        }),
      ]);
    });

    it('moveTaskToList is a no-op when the task is already in the destination list', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      onSnapshotCallbacks.get('boards/board-1/tasks')!(
        collectionSnapshot([{ id: 't1', data: { title: 'X', listId: 'list-1', order: 'a0' } }]),
      );

      await store.moveTaskToList('t1', 'list-1');

      expect(boardService.moveTask).not.toHaveBeenCalled();
    });
  });

  describe('migrateTaskToBoard', () => {
    it('forwards the migration to BoardService with the source board title in metadata', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      onSnapshotCallbacks.get('boards/board-1')!(docSnapshot('board-1', { title: 'Source Board' }));

      const newId = await store.migrateTaskToBoard('t1', 'board-2', 'list-x', 'Target Board');

      expect(newId).toBe('task-new-id');
      expect(boardService.migrateTaskToBoard).toHaveBeenCalledWith(
        'board-1',
        't1',
        'board-2',
        'list-x',
        'u1',
        { fromBoardName: 'Source Board', toBoardName: 'Target Board' },
      );
    });
  });

  describe('calendar sync', () => {
    function seedTask(data: Record<string, unknown>) {
      onSnapshotCallbacks.get('boards/board-1/tasks')!(
        collectionSnapshot([{ id: 't1', data: { title: 'X', listId: 'list-1', ...data } }]),
      );
    }

    it('syncTaskToCalendar is called after addTask when sync is on and a due date is set', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      const created = {
        id: 't1',
        listId: 'list-1',
        calendarSyncEnabled: true,
        dueDate: new Date(),
      };
      boardService.addTask.mockResolvedValue(created);

      await store.addTask('list-1', { title: 'X', calendarSyncEnabled: true });
      await Promise.resolve(); // let the fire-and-forget sync land

      expect(syncService.syncTaskToCalendar).toHaveBeenCalledWith('board-1', created);
    });

    it('addTask does not sync when calendarSyncEnabled is false', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      boardService.addTask.mockResolvedValue({
        id: 't1',
        listId: 'list-1',
        calendarSyncEnabled: false,
      });

      await store.addTask('list-1', { title: 'X' });
      await Promise.resolve();

      expect(syncService.syncTaskToCalendar).not.toHaveBeenCalled();
    });

    it('updateTask calls syncTaskToCalendar when sync stays on and a due date is present', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      seedTask({ calendarSyncEnabled: true, dueDate: { toDate: () => new Date() } });

      await store.updateTask('t1', { title: 'Updated' });
      await Promise.resolve();

      expect(syncService.syncTaskToCalendar).toHaveBeenCalled();
    });

    it('updateTask calls unlinkTaskFromCalendar when sync is toggled off', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      seedTask({ calendarSyncEnabled: true, calendarEventId: 'evt-1' });

      await store.updateTask('t1', { calendarSyncEnabled: false });
      await Promise.resolve();

      expect(syncService.unlinkTaskFromCalendar).toHaveBeenCalled();
      expect(syncService.syncTaskToCalendar).not.toHaveBeenCalled();
    });

    it('updateTask does not sync when calendarSyncEnabled stays off', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      seedTask({ calendarSyncEnabled: false });

      await store.updateTask('t1', { title: 'Updated' });
      await Promise.resolve();

      expect(syncService.syncTaskToCalendar).not.toHaveBeenCalled();
      expect(syncService.unlinkTaskFromCalendar).not.toHaveBeenCalled();
    });
  });

  describe('drag-and-drop reordering', () => {
    function seedTwoLists(store: BoardStore) {
      onSnapshotCallbacks.get('boards/board-1/lists')!(
        collectionSnapshot([
          { id: 'list-1', data: { title: 'To Do', order: 'a0' } },
          { id: 'list-2', data: { title: 'Done', order: 'a2' } },
        ]),
      );
      onSnapshotCallbacks.get('boards/board-1/tasks')!(
        collectionSnapshot([
          { id: 't1', data: { title: 'T1', listId: 'list-1', order: 'a0' } },
          { id: 't2', data: { title: 'T2', listId: 'list-1', order: 'a1' } },
          { id: 't3', data: { title: 'T3', listId: 'list-2', order: 'a0' } },
        ]),
      );
    }

    it('moveTaskToIndex derives an order key placing the task at the target slot', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      seedTwoLists(store);

      // Move t1 to index 0 of list-2 (before t3).
      await store.moveTaskToIndex('t1', 'list-2', 0);

      const [, taskId, destListId, order] = boardService.moveTask.mock.calls[0];
      expect(taskId).toBe('t1');
      expect(destListId).toBe('list-2');
      expect(order < 'a0').toBe(true); // before t3's 'a0'
    });

    it('applies an optimistic override immediately, before the service resolves', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      seedTwoLists(store);

      let resolveMove!: () => void;
      boardService.moveTask.mockImplementation(() => new Promise<void>((r) => (resolveMove = r)));

      const promise = store.moveTaskToIndex('t1', 'list-2', 1);

      // Before the write resolves, listsWithTasks already shows t1 under list-2.
      const list2 = store.listsWithTasks().find((l) => l.id === 'list-2');
      expect(list2?.tasks.map((t) => t.id)).toContain('t1');

      resolveMove();
      await promise;
    });

    it('rolls back the optimistic override when the move fails', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      seedTwoLists(store);
      boardService.moveTask.mockRejectedValue(new Error('offline'));

      await expect(store.moveTaskToIndex('t1', 'list-2', 0)).rejects.toThrow('offline');

      const list1 = store.listsWithTasks().find((l) => l.id === 'list-1');
      expect(list1?.tasks.map((t) => t.id)).toContain('t1'); // reverted to original list
    });

    it('reorderListToIndex derives an order key for the list’s new slot', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      seedTwoLists(store);

      await store.reorderListToIndex('list-2', 0);

      const [, listId, order] = boardService.reorderLists.mock.calls[0];
      expect(listId).toBe('list-2');
      expect(order < 'a0').toBe(true); // before list-1's 'a0'
    });
  });

  describe('list mutations', () => {
    it('addList forwards the input to BoardService with the active board id', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();

      const list = await store.addList({ title: 'New' });

      expect(boardService.addList).toHaveBeenCalledWith('board-1', { title: 'New' });
      expect(list.id).toBe('list-new');
    });

    it('updateListTitle forwards to BoardService with the active board id', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();

      await store.updateListTitle('list-1', { title: 'Renamed' });

      expect(boardService.updateList).toHaveBeenCalledWith('board-1', 'list-1', { title: 'Renamed' });
    });

    it('deleteList forwards to BoardService with the active board id', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();

      await store.deleteList('list-1');

      expect(boardService.deleteList).toHaveBeenCalledWith('board-1', 'list-1');
    });
  });

  describe('task mutations edge cases', () => {
    it('addTask throws when no user is signed in', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: FIRESTORE_DB, useValue: {} },
          { provide: ActivatedRoute, useValue: { paramMap: paramMap$ } },
          { provide: AuthStore, useValue: { user: signal(null) } },
          { provide: BoardService, useValue: boardService },
          { provide: SyncService, useValue: syncService },
          { provide: UserService, useValue: { getUsersByIds: vi.fn().mockResolvedValue([]) } },
          BoardStore,
        ],
      });

      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();

      await expect(store.addTask('list-1', { title: 'T' })).rejects.toThrow(/not authenticated/i);
      expect(boardService.addTask).not.toHaveBeenCalled();
    });

    it('deleteTask forwards to BoardService with the active board id', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();

      await store.deleteTask('t1');

      expect(boardService.deleteTask).toHaveBeenCalledWith('board-1', 't1');
    });

    it('moveTask rolls back the optimistic override when the service throws', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      onSnapshotCallbacks.get('boards/board-1/lists')!(
        collectionSnapshot([{ id: 'list-1', data: { title: 'To Do', order: 'a0' } }]),
      );
      onSnapshotCallbacks.get('boards/board-1/tasks')!(
        collectionSnapshot([{ id: 't1', data: { title: 'X', listId: 'list-1', order: 'a0' } }]),
      );
      boardService.moveTask.mockRejectedValueOnce(new Error('offline'));

      await expect(store.moveTask('t1', 'list-2', 'a5')).rejects.toThrow('offline');
      // The task-overrides entry for t1 has been cleared, so list-1 still owns t1.
      const list1 = store.listsWithTasks().find((l) => l.id === 'list-1');
      expect(list1?.tasks.map((t) => t.id) ?? []).toContain('t1');
    });

    it('reorderList rolls back the optimistic list-order override when the service throws', async () => {
      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();
      onSnapshotCallbacks.get('boards/board-1/lists')!(
        collectionSnapshot([
          { id: 'list-1', data: { title: 'To Do', order: 'a0' } },
          { id: 'list-2', data: { title: 'Doing', order: 'a1' } },
        ]),
      );
      boardService.reorderLists.mockRejectedValueOnce(new Error('offline'));

      await expect(store['reorderList']('list-1', 'a5')).rejects.toThrow('offline');
      // After rollback the effective order is unchanged.
      const order = store.listsWithTasks().find((l) => l.id === 'list-1');
      expect(order?.order).toBe('a0');
    });

    it('migrateTaskToBoard throws when no user is signed in', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: FIRESTORE_DB, useValue: {} },
          { provide: ActivatedRoute, useValue: { paramMap: paramMap$ } },
          { provide: AuthStore, useValue: { user: signal(null) } },
          { provide: BoardService, useValue: boardService },
          { provide: SyncService, useValue: syncService },
          { provide: UserService, useValue: { getUsersByIds: vi.fn().mockResolvedValue([]) } },
          BoardStore,
        ],
      });

      const store = TestBed.inject(BoardStore);
      TestBed.flushEffects();

      await expect(store.migrateTaskToBoard('t1', 'board-2', 'list-x', 'Target')).rejects.toThrow(
        /not authenticated/i,
      );
      expect(boardService.migrateTaskToBoard).not.toHaveBeenCalled();
    });
  });
});
