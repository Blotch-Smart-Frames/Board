import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { onSnapshot } from 'firebase/firestore';
import { FIRESTORE_DB } from '../../../core/firebase/firebase.config';
import { AuthStore } from '../../../core/auth/auth.store';
import { BoardService } from '../../../core/services/board.service';
import { BoardOrderService } from '../../../core/services/board-order.service';
import { UserBoardsStore } from './user-boards.store';

type SnapshotCallback = (snapshot: unknown) => void;

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'collection', path: segments.join('/') })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ type: 'doc', path: segments.join('/') })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ type: 'query', ref, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderBy: vi.fn((field: string, direction?: string) => ({ orderBy: field, direction })),
  onSnapshot: vi.fn(),
}));

function collectionSnapshot(docs: { id: string; data: Record<string, unknown> }[]) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

function docSnapshot(id: string, data: Record<string, unknown> | undefined) {
  return { exists: () => data !== undefined, id, data: () => data };
}

// The store subscribes to owned boards, then collaborated boards, then the
// order doc — in that field-declaration order — so registrations are tracked
// positionally rather than by path (owned/collaborated both query "boards").
describe('UserBoardsStore', () => {
  let boardOrderService: { setBoardOrder: ReturnType<typeof vi.fn> };
  let boardService: {
    createBoard: ReturnType<typeof vi.fn>;
    updateBoard: ReturnType<typeof vi.fn>;
    deleteBoard: ReturnType<typeof vi.fn>;
  };
  let registrations: SnapshotCallback[];
  let userSignal: ReturnType<typeof signal<{ uid: string } | null | undefined>>;

  beforeEach(() => {
    vi.clearAllMocks();
    registrations = [];
    userSignal = signal({ uid: 'u1' });
    boardOrderService = { setBoardOrder: vi.fn().mockResolvedValue(undefined) };
    boardService = {
      createBoard: vi.fn(),
      updateBoard: vi.fn().mockResolvedValue(undefined),
      deleteBoard: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(onSnapshot).mockImplementation((_ref: unknown, onNext: unknown) => {
      registrations.push(onNext as SnapshotCallback);
      return vi.fn();
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: FIRESTORE_DB, useValue: {} },
        { provide: AuthStore, useValue: { user: userSignal } },
        { provide: BoardService, useValue: boardService },
        { provide: BoardOrderService, useValue: boardOrderService },
      ],
    });
  });

  function injectStore() {
    const store = TestBed.inject(UserBoardsStore);
    TestBed.flushEffects();
    return store;
  }

  function board(id: string, extra: Record<string, unknown> = {}) {
    return { id, data: { title: id, ownerId: 'u1', collaborators: [], ...extra } };
  }

  it('merges owned and collaborated boards, preferring the owned copy on overlap', () => {
    const store = injectStore();
    expect(registrations).toHaveLength(3); // owned, collaborated, orderDoc

    registrations[0](collectionSnapshot([board('a', { title: 'Owned A' }), board('shared', { title: 'Owned copy' })]));
    registrations[1](collectionSnapshot([board('shared', { title: 'Collaborated copy' })]));
    registrations[2](docSnapshot('boardOrder', { boards: { a: 'a0', shared: 'a1' } }));

    const boards = store.boards();
    expect(boards.map((b) => b.id)).toEqual(['a', 'shared']);
    expect(boards.find((b) => b.id === 'shared')?.title).toBe('Owned copy');
  });

  it('synthesizes a trailing order for boards missing one, then sorts by order', () => {
    const store = injectStore();

    registrations[0](collectionSnapshot([board('a'), board('b')]));
    registrations[1](collectionSnapshot([]));
    registrations[2](docSnapshot('boardOrder', { boards: { b: 'a0' } }));

    const boards = store.boards();
    expect(boards.every((b) => typeof b.order === 'string')).toBe(true);
    expect(boards[0].id).toBe('b'); // explicit order 'a0' sorts before the synthesized trailing order
  });

  it('reports isLoading until the owned-boards snapshot has arrived', () => {
    const store = injectStore();

    expect(store.isLoading()).toBe(true);

    registrations[0](collectionSnapshot([]));

    expect(store.isLoading()).toBe(false);
  });

  it('createBoard delegates to BoardService with the current user id', async () => {
    const store = injectStore();
    boardService.createBoard.mockResolvedValue({ id: 'new-board' });

    await store.createBoard({ title: 'New board' });

    expect(boardService.createBoard).toHaveBeenCalledWith({ title: 'New board' }, 'u1');
  });

  it('reorderBoard persists through BoardOrderService', async () => {
    const store = injectStore();

    await store.reorderBoard('board-1', 'a1');

    expect(boardOrderService.setBoardOrder).toHaveBeenCalledWith('u1', 'board-1', 'a1');
  });

  it('reorderBoardToIndex derives an order key for the target slot and reorders optimistically', async () => {
    const store = injectStore();
    registrations[0](collectionSnapshot([board('a'), board('b'), board('c')]));
    registrations[1](collectionSnapshot([]));
    registrations[2](docSnapshot('boardOrder', { boards: { a: 'a0', b: 'a1', c: 'a2' } }));

    await store.reorderBoardToIndex('c', 0);

    const [userId, boardId, order] = boardOrderService.setBoardOrder.mock.calls[0];
    expect(userId).toBe('u1');
    expect(boardId).toBe('c');
    expect(order < 'a0').toBe(true); // before board 'a'
    // Optimistic overlay places 'c' first straight away.
    expect(store.boards().map((b) => b.id)).toEqual(['c', 'a', 'b']);
  });

  it('rolls back the optimistic order when persistence fails', async () => {
    const store = injectStore();
    registrations[0](collectionSnapshot([board('a'), board('b')]));
    registrations[1](collectionSnapshot([]));
    registrations[2](docSnapshot('boardOrder', { boards: { a: 'a0', b: 'a1' } }));
    boardOrderService.setBoardOrder.mockRejectedValue(new Error('offline'));

    await expect(store.reorderBoardToIndex('b', 0)).rejects.toThrow('offline');

    expect(store.boards().map((b) => b.id)).toEqual(['a', 'b']); // reverted
  });

  it('renameBoard delegates to BoardService.updateBoard', async () => {
    const store = injectStore();

    await store.renameBoard('board-1', 'New title');

    expect(boardService.updateBoard).toHaveBeenCalledWith('board-1', { title: 'New title' });
  });

  it('deleteBoard delegates to BoardService.deleteBoard', async () => {
    const store = injectStore();

    await store.deleteBoard('board-1');

    expect(boardService.deleteBoard).toHaveBeenCalledWith('board-1');
  });

  it('throws when acting while signed out', async () => {
    userSignal.set(null);
    const store = injectStore();

    await expect(store.createBoard({ title: 'x' })).rejects.toThrow('Not authenticated');
    await expect(store.reorderBoard('b1', 'a0')).rejects.toThrow('Not authenticated');
  });
});
