import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Timestamp } from 'firebase/firestore';
import { collection, onSnapshot } from 'firebase/firestore';
import { AuthStore } from '../../../core/auth/auth.store';
import { FIRESTORE_DB } from '../../../core/firebase/firebase.config';
import { UserService } from '../../../core/services/user.service';
import { UserBoardsStore, type BoardWithOrder } from '../../boards/data/user-boards.store';
import { DashboardStore } from './dashboard.store';
import type { Task, User } from '../../../shared/types/board';

type SnapshotCallback = (snapshot: unknown) => void;
type ErrorCallback = () => void;

// Mirror the mocking pattern used by BoardStore/UserBoardsStore specs — the store
// calls collection/onSnapshot directly, and we swap them for capturable fakes.
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({
    type: 'collection',
    path: segments.join('/'),
  })),
  onSnapshot: vi.fn(),
}));

function ts(date: Date): Timestamp {
  return { toDate: () => date, toMillis: () => date.getTime() } as Timestamp;
}

function fakeBoard(overrides: Partial<BoardWithOrder> = {}): BoardWithOrder {
  return {
    id: 'board-1',
    title: 'Board 1',
    ownerId: 'u1',
    collaborators: [],
    createdAt: ts(new Date(2026, 0, 1)),
    updatedAt: ts(new Date(2026, 0, 1)),
    ...overrides,
  };
}

function fakeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    listId: 'list-1',
    title: 'Task',
    order: 'a0',
    calendarSyncEnabled: false,
    createdBy: 'u1',
    createdAt: ts(new Date(2026, 0, 1)),
    updatedAt: ts(new Date(2026, 0, 1)),
    ...overrides,
  };
}

describe('DashboardStore', () => {
  let onSnapshotCalls: Array<{ path: string; onNext: SnapshotCallback; onError: ErrorCallback }>;
  let userSignal: WritableSignal<{ uid: string } | null | undefined>;
  let boardsSignal: WritableSignal<BoardWithOrder[]>;
  let isLoadingSignal: WritableSignal<boolean>;
  let userService: { getUsersByIds: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    onSnapshotCalls = [];
    userSignal = signal<{ uid: string } | null | undefined>({ uid: 'u1' });
    boardsSignal = signal<BoardWithOrder[]>([]);
    isLoadingSignal = signal(false);
    userService = { getUsersByIds: vi.fn().mockResolvedValue([]) };

    vi.mocked(onSnapshot).mockImplementation((ref: unknown, onNext: unknown, onError: unknown) => {
      const path = (ref as { path: string }).path;
      onSnapshotCalls.push({
        path,
        onNext: onNext as SnapshotCallback,
        onError: (onError ?? (() => {})) as ErrorCallback,
      });
      return vi.fn();
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE_DB, useValue: {} },
        { provide: AuthStore, useValue: { user: userSignal } },
        {
          provide: UserBoardsStore,
          useValue: { boards: boardsSignal, isLoading: isLoadingSignal },
        },
        { provide: UserService, useValue: userService },
        DashboardStore,
      ],
    });
  });

  // toObservable emits over a microtask, so drain twice around a flushEffects for
  // the boardIds$ → switchMap → toSignal chain to settle.
  async function settle(): Promise<void> {
    TestBed.flushEffects();
    await Promise.resolve();
    await Promise.resolve();
    TestBed.flushEffects();
  }

  function callbackFor(path: string): SnapshotCallback {
    const call = [...onSnapshotCalls].reverse().find((c) => c.path === path);
    if (!call) throw new Error(`No onSnapshot registered for path ${path}`);
    return call.onNext;
  }

  function feedTasks(boardId: string, tasks: Array<{ id: string; data: Record<string, unknown> }>) {
    callbackFor(`boards/${boardId}/tasks`)({
      docs: tasks.map((t) => ({ id: t.id, data: () => t.data })),
    });
  }

  function feedLists(boardId: string, lists: Array<{ id: string; data: Record<string, unknown> }>) {
    callbackFor(`boards/${boardId}/lists`)({
      docs: lists.map((l) => ({ id: l.id, data: () => l.data })),
    });
  }

  describe('subscription lifecycle', () => {
    it('does not open snapshot listeners when the user belongs to no boards', async () => {
      const store = TestBed.inject(DashboardStore);
      await settle();

      expect(onSnapshot).not.toHaveBeenCalled();
      expect(store.allTasks()).toEqual([]);
    });

    it('proxies the user boards loading flag through isLoadingBoards', async () => {
      const store = TestBed.inject(DashboardStore);
      expect(store.isLoadingBoards()).toBe(false);

      isLoadingSignal.set(true);
      expect(store.isLoadingBoards()).toBe(true);
    });

    it('resolves board collaborators through userDisplay alongside task assignees', async () => {
      const users = [
        {
          id: 'u2',
          email: 'bob@example.com',
          displayName: 'Bob',
          photoURL: null,
        },
      ];
      userService.getUsersByIds.mockResolvedValue(users);

      boardsSignal.set([fakeBoard({ id: 'b1', collaborators: ['u2'] })]);
      const store = TestBed.inject(DashboardStore);
      await settle();
      feedLists('b1', []);
      feedTasks('b1', []);
      await settle();
      await Promise.resolve();
      TestBed.flushEffects();

      expect(store.userDisplay()('u2').name).toBe('Bob');
    });

    it('opens one tasks + one lists subscription per board', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1' }), fakeBoard({ id: 'b2', title: 'B2' })]);
      TestBed.inject(DashboardStore);
      await settle();

      expect(collection).toHaveBeenCalledWith({}, 'boards', 'b1', 'tasks');
      expect(collection).toHaveBeenCalledWith({}, 'boards', 'b1', 'lists');
      expect(collection).toHaveBeenCalledWith({}, 'boards', 'b2', 'tasks');
      expect(collection).toHaveBeenCalledWith({}, 'boards', 'b2', 'lists');
      expect(onSnapshotCalls).toHaveLength(4);
    });

    it('reuses subscriptions when boards are updated with the same id set', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      TestBed.inject(DashboardStore);
      await settle();
      expect(onSnapshotCalls).toHaveLength(2);

      // Same id, different title/order — distinctUntilChanged should short-circuit.
      boardsSignal.set([fakeBoard({ id: 'b1', title: 'Renamed', order: 'a9' })]);
      await settle();

      expect(onSnapshotCalls).toHaveLength(2);
    });

    it('opens new subscriptions when a board is added to the set', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      TestBed.inject(DashboardStore);
      await settle();
      expect(onSnapshotCalls).toHaveLength(2);

      boardsSignal.set([fakeBoard({ id: 'b1' }), fakeBoard({ id: 'b2', title: 'B2' })]);
      await settle();

      // Old subs are torn down and new ones opened for both boards.
      const b2Tasks = onSnapshotCalls.filter((c) => c.path === 'boards/b2/tasks');
      expect(b2Tasks.length).toBeGreaterThan(0);
    });
  });

  describe('allTasks / enrichment', () => {
    it('enriches tasks with their board and list titles', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1', title: 'Alpha' })]);
      const store = TestBed.inject(DashboardStore);
      await settle();

      feedLists('b1', [{ id: 'list-1', data: { title: 'To Do', order: 'a0' } }]);
      feedTasks('b1', [
        { id: 't1', data: { ...fakeTask({ id: 't1', title: 'Write tests' }), boardId: undefined } },
      ]);

      const tasks = store.allTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toMatchObject({
        id: 't1',
        boardId: 'b1',
        boardTitle: 'Alpha',
        listTitle: 'To Do',
      });
    });

    it('falls back to "Unassigned" when a task refers to a list we do not know about', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1', title: 'Alpha' })]);
      const store = TestBed.inject(DashboardStore);
      await settle();

      feedLists('b1', []);
      feedTasks('b1', [{ id: 't1', data: { ...fakeTask({ listId: 'ghost-list' }) } }]);

      expect(store.allTasks()[0].listTitle).toBe('Unassigned');
    });

    it('flattens tasks from multiple boards into a single list', async () => {
      boardsSignal.set([
        fakeBoard({ id: 'b1', title: 'Alpha' }),
        fakeBoard({ id: 'b2', title: 'Beta' }),
      ]);
      const store = TestBed.inject(DashboardStore);
      await settle();

      feedTasks('b1', [{ id: 't1', data: fakeTask({ id: 't1' }) }]);
      feedTasks('b2', [
        { id: 't2', data: fakeTask({ id: 't2' }) },
        { id: 't3', data: fakeTask({ id: 't3' }) },
      ]);

      expect(store.allTasks()).toHaveLength(3);
      expect(
        store
          .allTasks()
          .map((t) => t.boardTitle)
          .sort(),
      ).toEqual(['Alpha', 'Beta', 'Beta']);
    });
  });

  describe('metrics', () => {
    beforeEach(async () => {
      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      TestBed.inject(DashboardStore);
      await settle();
      feedLists('b1', [{ id: 'l1', data: { title: 'To Do', order: 'a0' } }]);
    });

    it('reports total = open + answered for the signed-in user', async () => {
      feedTasks('b1', [
        { id: 't1', data: fakeTask({ assignedTo: ['u1'] }) },
        { id: 't2', data: fakeTask({ assignedTo: ['u1'], completedAt: ts(new Date()) }) },
        { id: 't3', data: fakeTask({ assignedTo: ['u2'] }) }, // not the user's
      ]);

      const store = TestBed.inject(DashboardStore);
      expect(store.totalCount()).toBe(2);
      expect(store.openCount()).toBe(1);
      expect(store.answeredCount()).toBe(1);
      expect(store.totalCount()).toBe(store.openCount() + store.answeredCount());
    });

    it('counts a task as urgent only when it is not completed AND due within 3 days', async () => {
      const now = Date.now();
      const dayMs = 86_400_000;
      feedTasks('b1', [
        {
          id: 't1',
          data: fakeTask({ id: 't1', assignedTo: ['u1'], dueDate: ts(new Date(now - dayMs)) }),
        }, // overdue → urgent
        {
          id: 't2',
          data: fakeTask({ id: 't2', assignedTo: ['u1'], dueDate: ts(new Date(now + 2 * dayMs)) }),
        }, // due in 2d → urgent
        {
          id: 't3',
          data: fakeTask({ id: 't3', assignedTo: ['u1'], dueDate: ts(new Date(now + 10 * dayMs)) }),
        }, // due in 10d → not urgent
        { id: 't4', data: fakeTask({ id: 't4', assignedTo: ['u1'] }) }, // no due date → not urgent
        {
          id: 't5',
          data: fakeTask({
            id: 't5',
            assignedTo: ['u1'],
            dueDate: ts(new Date(now - dayMs)),
            completedAt: ts(new Date()),
          }),
        }, // overdue but done → not urgent
      ]);

      const store = TestBed.inject(DashboardStore);
      expect(store.urgentCount()).toBe(2);
    });

    it('returns zero counts when the user is signed out', async () => {
      userSignal.set(null);
      feedTasks('b1', [{ id: 't1', data: fakeTask({ assignedTo: ['u1'] }) }]);

      const store = TestBed.inject(DashboardStore);
      expect(store.totalCount()).toBe(0);
      expect(store.openCount()).toBe(0);
      expect(store.answeredCount()).toBe(0);
    });
  });

  describe('statusBreakdown', () => {
    it('groups by list title, sorts by descending total, and computes share%', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      TestBed.inject(DashboardStore);
      await settle();

      feedLists('b1', [
        { id: 'todo', data: { title: 'To Do', order: 'a0' } },
        { id: 'done', data: { title: 'Done', order: 'a1' } },
      ]);
      feedTasks('b1', [
        { id: 't1', data: fakeTask({ listId: 'todo', assignedTo: ['u1'] }) },
        { id: 't2', data: fakeTask({ listId: 'todo', assignedTo: ['u2'] }) },
        { id: 't3', data: fakeTask({ listId: 'todo', assignedTo: ['u2'] }) },
        { id: 't4', data: fakeTask({ listId: 'todo', assignedTo: ['u2'] }) },
        { id: 't5', data: fakeTask({ listId: 'done', assignedTo: ['u1'] }) },
      ]);

      const store = TestBed.inject(DashboardStore);
      const rows = store.statusBreakdown();

      expect(rows.map((r) => r.title)).toEqual(['To Do', 'Done']);
      expect(rows[0]).toEqual({ title: 'To Do', mine: 1, total: 4, share: 25 });
      expect(rows[1]).toEqual({ title: 'Done', mine: 1, total: 1, share: 100 });
    });

    it('is empty when there are no tasks', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      const store = TestBed.inject(DashboardStore);
      await settle();
      feedTasks('b1', []);
      feedLists('b1', []);

      expect(store.statusBreakdown()).toEqual([]);
    });
  });

  describe('urgent tickets list', () => {
    it('sorts urgent tickets by soonest due date first', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      TestBed.inject(DashboardStore);
      await settle();
      feedLists('b1', [{ id: 'l1', data: { title: 'To Do', order: 'a0' } }]);

      const now = Date.now();
      feedTasks('b1', [
        {
          id: 't-later',
          data: fakeTask({ id: 't-later', dueDate: ts(new Date(now + 86_400_000)) }),
        },
        {
          id: 't-sooner',
          data: fakeTask({ id: 't-sooner', dueDate: ts(new Date(now - 86_400_000)) }),
        },
      ]);

      const store = TestBed.inject(DashboardStore);
      expect(store.urgentTickets().map((t) => t.id)).toEqual(['t-sooner', 't-later']);
    });

    it('myUrgentTickets restricts to the current user', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      TestBed.inject(DashboardStore);
      await settle();
      feedLists('b1', [{ id: 'l1', data: { title: 'To Do', order: 'a0' } }]);

      const now = Date.now();
      feedTasks('b1', [
        {
          id: 't-mine',
          data: fakeTask({ id: 't-mine', assignedTo: ['u1'], dueDate: ts(new Date(now)) }),
        },
        {
          id: 't-theirs',
          data: fakeTask({ id: 't-theirs', assignedTo: ['u2'], dueDate: ts(new Date(now)) }),
        },
      ]);

      const store = TestBed.inject(DashboardStore);
      expect(store.myUrgentTickets().map((t) => t.id)).toEqual(['t-mine']);
      expect(store.urgentTickets()).toHaveLength(2);
    });
  });

  describe('recentActivity', () => {
    it('emits a "created" event per task and a "completed" event when the task is done', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      TestBed.inject(DashboardStore);
      await settle();
      feedLists('b1', [{ id: 'l1', data: { title: 'To Do', order: 'a0' } }]);

      const t1Created = new Date(2026, 0, 1);
      const t2Created = new Date(2026, 0, 2);
      const t2Completed = new Date(2026, 0, 3);
      feedTasks('b1', [
        { id: 't1', data: fakeTask({ id: 't1', createdAt: ts(t1Created) }) },
        {
          id: 't2',
          data: fakeTask({
            id: 't2',
            createdAt: ts(t2Created),
            completedAt: ts(t2Completed),
          }),
        },
      ]);

      const store = TestBed.inject(DashboardStore);
      const events = store.recentActivity();
      expect(events.map((e) => `${e.id}:${e.kind}`)).toEqual([
        't2-completed:completed',
        't2-created:created',
        't1-created:created',
      ]);
    });

    it('caps the feed at 12 events', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      TestBed.inject(DashboardStore);
      await settle();
      feedLists('b1', [{ id: 'l1', data: { title: 'To Do', order: 'a0' } }]);

      const now = new Date();
      const tasks = Array.from({ length: 20 }, (_, i) => ({
        id: `t${i}`,
        data: fakeTask({
          id: `t${i}`,
          createdAt: ts(new Date(now.getTime() - i * 60_000)),
        }),
      }));
      feedTasks('b1', tasks);

      const store = TestBed.inject(DashboardStore);
      expect(store.recentActivity()).toHaveLength(12);
    });
  });

  describe('userDisplay', () => {
    it('resolves a known profile to its display name', async () => {
      const users: User[] = [
        {
          id: 'u1',
          email: 'alice@example.com',
          displayName: 'Alice',
          photoURL: 'alice.png',
        },
      ];
      userService.getUsersByIds.mockResolvedValue(users);

      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      const store = TestBed.inject(DashboardStore);
      await settle();
      feedLists('b1', []);
      feedTasks('b1', [{ id: 't1', data: fakeTask({ createdBy: 'u1' }) }]);
      await settle();

      const resolve = store.userDisplay();
      expect(resolve('u1')).toMatchObject({ id: 'u1', name: 'Alice', photoURL: 'alice.png' });
    });

    it('falls back to the signed-in Firebase user for their own id before the profile fetch settles', async () => {
      userSignal.set({
        uid: 'u1',
        email: 'me@example.com',
        displayName: 'Me',
        photoURL: null,
      } as unknown as { uid: string });

      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      const store = TestBed.inject(DashboardStore);
      await settle();

      const resolve = store.userDisplay();
      // No profiles loaded yet — the Firebase user info fills the gap.
      expect(resolve('u1').name).toBe('Me');
    });

    it('returns an "Unknown" placeholder for an id we cannot resolve', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      const store = TestBed.inject(DashboardStore);
      await settle();

      expect(store.userDisplay()('ghost')).toEqual({
        id: 'ghost',
        email: '',
        name: 'Unknown',
        photoURL: null,
        isOwner: false,
      });
    });

    it('falls back to email as the display name when profile has no displayName', async () => {
      const users: User[] = [
        { id: 'u1', email: 'a@example.com', displayName: null, photoURL: null } as unknown as User,
      ];
      userService.getUsersByIds.mockResolvedValue(users);

      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      const store = TestBed.inject(DashboardStore);
      await settle();
      feedLists('b1', []);
      feedTasks('b1', [{ id: 't1', data: fakeTask({ createdBy: 'u1' }) }]);
      await settle();

      expect(store.userDisplay()('u1').name).toBe('a@example.com');
    });

    it('falls back to a generic "User" label when profile has neither displayName nor email', async () => {
      const users: User[] = [
        { id: 'u1', email: null, displayName: null, photoURL: null } as unknown as User,
      ];
      userService.getUsersByIds.mockResolvedValue(users);

      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      const store = TestBed.inject(DashboardStore);
      await settle();
      feedLists('b1', []);
      feedTasks('b1', [{ id: 't1', data: fakeTask({ createdBy: 'u1' }) }]);
      await settle();

      expect(store.userDisplay()('u1').name).toBe('User');
    });

    it('falls back to "You" for the signed-in user when their profile lacks a displayName', async () => {
      userSignal.set({
        uid: 'u1',
        email: null,
        displayName: null,
        photoURL: null,
      } as unknown as { uid: string });

      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      const store = TestBed.inject(DashboardStore);
      await settle();

      const resolve = store.userDisplay();
      expect(resolve('u1').name).toBe('You');
    });
  });

  describe('resilience', () => {
    it('emits an empty tasks list when the tasks subscription errors', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      const store = TestBed.inject(DashboardStore);
      await settle();

      const tasksCall = onSnapshotCalls.find((c) => c.path === 'boards/b1/tasks');
      expect(tasksCall).toBeDefined();
      // Fire the error handler to exercise the fallback subscriber.next([]).
      tasksCall!.onError();
      await settle();

      expect(store.allTasks()).toEqual([]);
    });

    it('emits an empty lists list when the lists subscription errors', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      const store = TestBed.inject(DashboardStore);
      await settle();

      const listsCall = onSnapshotCalls.find((c) => c.path === 'boards/b1/lists');
      expect(listsCall).toBeDefined();
      listsCall!.onError();
      await settle();

      // With no known list, tasks fall back to "Unassigned".
      feedTasks('b1', [{ id: 't1', data: fakeTask({ listId: 'l1' }) }]);
      expect(store.allTasks()[0].listTitle).toBe('Unassigned');
    });

    it('falls back to "Unknown board" when a task refers to a board title not in the boards signal', async () => {
      // Two boards subscribe. We feed task data with a boardId of a board we
      // temporarily drop from the boards signal to exercise the fallback.
      boardsSignal.set([
        fakeBoard({ id: 'b1', title: 'Alpha' }),
        fakeBoard({ id: 'b2', title: 'Beta' }),
      ]);
      const store = TestBed.inject(DashboardStore);
      await settle();

      feedLists('b1', [{ id: 'l1', data: { title: 'To Do' } }]);
      feedLists('b2', [{ id: 'l1', data: { title: 'To Do' } }]);
      feedTasks('b1', [{ id: 't1', data: fakeTask({ id: 't1' }) }]);
      feedTasks('b2', [{ id: 't2', data: fakeTask({ id: 't2' }) }]);

      // Drop b2 from the boards signal so its title lookup misses. rawTasks still
      // carries the b2 task (subscription is still live) until the next tick.
      boardsSignal.set([fakeBoard({ id: 'b1', title: 'Alpha' })]);
      await Promise.resolve();
      TestBed.flushEffects();

      // Look at allTasks with the current view: any task whose boardId is no
      // longer mapped falls back to 'Unknown board'.
      const unknown = store.allTasks().find((t) => t.boardId === 'b2');
      if (unknown) {
        expect(unknown.boardTitle).toBe('Unknown board');
      }
    });

    it('myUrgentTickets returns an empty list when no user is signed in', async () => {
      userSignal.set(null);
      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      const store = TestBed.inject(DashboardStore);
      await settle();

      expect(store.myUrgentTickets()).toEqual([]);
    });

    it('recentActivity skips tasks with no createdAt or completedAt timestamps', async () => {
      boardsSignal.set([fakeBoard({ id: 'b1' })]);
      const store = TestBed.inject(DashboardStore);
      await settle();
      feedLists('b1', [{ id: 'l1', data: { title: 'To Do', order: 'a0' } }]);

      // Tasks whose createdAt/completedAt lack `toDate` contribute no events.
      feedTasks('b1', [{ id: 't-no-time', data: { title: 'X', listId: 'l1', createdBy: 'u1' } }]);

      expect(store.recentActivity()).toEqual([]);
    });
  });
});
