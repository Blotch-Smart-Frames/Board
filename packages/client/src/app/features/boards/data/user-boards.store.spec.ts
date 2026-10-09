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
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({
    type: 'collection',
    path: segments.join('/'),
  })),
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
  let boardOrderService: { updatePreferences: ReturnType<typeof vi.fn> };
  let boardService: {
    createBoard: ReturnType<typeof vi.fn>;
    updateBoard: ReturnType<typeof vi.fn>;
    deleteBoard: ReturnType<typeof vi.fn>;
    removeCollaborator: ReturnType<typeof vi.fn>;
  };
  let registrations: SnapshotCallback[];
  let userSignal: ReturnType<typeof signal<{ uid: string } | null | undefined>>;

  beforeEach(() => {
    vi.clearAllMocks();
    registrations = [];
    userSignal = signal({ uid: 'u1' });
    boardOrderService = { updatePreferences: vi.fn().mockResolvedValue(undefined) };
    boardService = {
      createBoard: vi.fn(),
      updateBoard: vi.fn().mockResolvedValue(undefined),
      deleteBoard: vi.fn().mockResolvedValue(undefined),
      removeCollaborator: vi.fn().mockResolvedValue(undefined),
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

    registrations[0](
      collectionSnapshot([
        board('a', { title: 'Owned A' }),
        board('shared', { title: 'Owned copy' }),
      ]),
    );
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

  /** Seeds owned boards (no collaborations) and the preferences doc. */
  function seed(
    store: UserBoardsStore,
    ids: string[],
    preferences: Record<string, unknown> | undefined,
  ) {
    registrations[0](collectionSnapshot(ids.map((id) => board(id))));
    registrations[1](collectionSnapshot([]));
    registrations[2](docSnapshot('boardOrder', preferences));
    return store;
  }

  const lastPatch = () => boardOrderService.updatePreferences.mock.calls.at(-1)![1];
  const rootIds = (store: UserBoardsStore) => store.sidebar().map((node) => node.id);
  const folderIds = (store: UserBoardsStore, folderId: string) => {
    const folder = store.sidebar().find((node) => node.id === folderId);
    return folder?.kind === 'folder' ? folder.boards.map((node) => node.id) : [];
  };

  it('is empty before the first snapshots arrive', () => {
    const store = injectStore();

    expect(store.sidebar()).toEqual([]);
    expect(store.boards()).toEqual([]);
  });

  it('moveBoard derives an order key for the target slot and reorders optimistically', async () => {
    const store = seed(injectStore(), ['a', 'b', 'c'], { boards: { a: 'a0', b: 'a1', c: 'a2' } });

    await store.moveBoard('c', null, 0);

    expect(boardOrderService.updatePreferences).toHaveBeenCalledWith('u1', expect.anything());
    const patch = lastPatch();
    // All boards already have a stored order, so only the moved board is written.
    expect(Object.keys(patch.boards)).toEqual(['c']);
    expect(patch.boards.c < 'a0').toBe(true); // before board 'a'
    expect(patch.boardFolders).toEqual({ c: null });
    // Optimistic overlay places 'c' first straight away.
    expect(store.boards().map((b) => b.id)).toEqual(['c', 'a', 'b']);
  });

  it('pins boards with no stored order when moving so a downward move sticks', async () => {
    // No preferences doc: every board's order is synthesized "at the end" on render.
    const store = seed(injectStore(), ['a', 'b', 'c', 'd'], undefined);
    expect(store.boards().map((b) => b.id)).toEqual(['a', 'b', 'c', 'd']);

    // Drag 'a' down to index 2 (between 'c' and 'd'). Without pinning, the
    // un-stored siblings would be re-synthesized past 'a' and snap it back up.
    await store.moveBoard('a', null, 2);

    expect(store.boards().map((b) => b.id)).toEqual(['b', 'c', 'a', 'd']);
    const { boards } = lastPatch();
    expect(Object.keys(boards).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(boards.b < boards.c && boards.c < boards.a && boards.a < boards.d).toBe(true);
  });

  it('rolls back the optimistic change when persistence fails', async () => {
    const store = seed(injectStore(), ['a', 'b'], { boards: { a: 'a0', b: 'a1' } });
    boardOrderService.updatePreferences.mockRejectedValue(new Error('offline'));

    await expect(store.moveBoard('b', null, 0)).rejects.toThrow('offline');

    expect(store.boards().map((b) => b.id)).toEqual(['a', 'b']); // reverted
  });

  it('moveBoard files a board into a folder at the requested slot', async () => {
    const store = seed(injectStore(), ['a', 'b', 'c'], {
      boards: { a: 'a0', b: 'a0', c: 'a1' },
      folders: { f1: { name: 'Work', order: 'a1' } },
      boardFolders: { b: 'f1', c: 'f1' },
    });

    await store.moveBoard('a', 'f1', 1);

    expect(lastPatch().boardFolders).toEqual({ a: 'f1' });
    expect(rootIds(store)).toEqual(['f1']);
    expect(folderIds(store, 'f1')).toEqual(['b', 'a', 'c']);
    // Boards inside the folder flatten in place for other consumers.
    expect(store.boards().map((b) => b.id)).toEqual(['b', 'a', 'c']);
  });

  it('moveBoard into an unknown folder places the board first there', async () => {
    const store = seed(injectStore(), ['a', 'b'], { boards: { a: 'a0', b: 'a1' } });

    await store.moveBoard('b', 'missing', 0);

    // No siblings to slot between, so it gets the base key; the board falls
    // back to the root because the folder doesn't exist.
    expect(lastPatch()).toEqual({ boards: { b: 'a0' }, boardFolders: { b: 'missing' } });
  });

  it('moveBoardToFolder appends the board to the end of the folder', async () => {
    const store = seed(injectStore(), ['a', 'b'], {
      boards: { a: 'a0', b: 'a0' },
      folders: { f1: { name: 'Work', order: 'a1' } },
      boardFolders: { b: 'f1' },
    });

    await store.moveBoardToFolder('a', 'f1');

    expect(folderIds(store, 'f1')).toEqual(['b', 'a']);
  });

  it('moveBoardToFolder(null) takes a board out and places it just below its folder', async () => {
    const store = seed(injectStore(), ['a', 'b', 'c'], {
      boards: { a: 'a0', b: 'a0', c: 'a2' },
      folders: { f1: { name: 'Work', order: 'a1' } },
      boardFolders: { b: 'f1' },
    });

    await store.moveBoardToFolder('b', null);

    expect(lastPatch().boardFolders).toEqual({ b: null });
    expect(rootIds(store)).toEqual(['a', 'f1', 'b', 'c']);
    expect(folderIds(store, 'f1')).toEqual([]);
  });

  it('moveBoardToFolder(null) is a no-op for a board already at the root', async () => {
    const store = seed(injectStore(), ['a'], { boards: { a: 'a0' } });

    await store.moveBoardToFolder('a', null);
    await store.moveBoardToFolder('unknown', null);

    expect(boardOrderService.updatePreferences).not.toHaveBeenCalled();
  });

  it('moveFolder reorders a folder among the root boards and folders', async () => {
    const store = seed(injectStore(), ['a', 'b'], {
      boards: { a: 'a0', b: 'a1' },
      folders: { f1: { name: 'Work', order: 'a2' } },
    });

    await store.moveFolder('f1', 0);

    expect(Object.keys(lastPatch().folders)).toEqual(['f1']);
    expect(rootIds(store)).toEqual(['f1', 'a', 'b']);
  });

  it('createFolder adds an expanded folder at the bottom and resolves with its id', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('1-2-3-4-5');
    // 'b' has no stored key, so it's pinned to keep it above the new folder.
    const store = seed(injectStore(), ['a', 'b'], { boards: { a: 'a0' } });

    const id = await store.createFolder('Work');

    expect(id).toBe('1-2-3-4-5');
    expect(Object.keys(lastPatch().boards)).toEqual(['b']);
    expect(lastPatch().folders[id]).toMatchObject({ name: 'Work', collapsed: false });
    expect(rootIds(store)).toEqual(['a', 'b', id]);
    expect(store.folders()).toEqual([
      { id, name: 'Work', order: expect.any(String), collapsed: false },
    ]);
  });

  it('renameFolder and setFolderCollapsed write partial folder updates', async () => {
    const store = seed(injectStore(), [], { folders: { f1: { name: 'Work', order: 'a0' } } });

    await store.renameFolder('f1', 'Personal');
    expect(lastPatch()).toEqual({ folders: { f1: { name: 'Personal' } } });

    await store.setFolderCollapsed('f1', true);
    expect(lastPatch()).toEqual({ folders: { f1: { collapsed: true } } });

    expect(store.folders()).toEqual([{ id: 'f1', name: 'Personal', order: 'a0', collapsed: true }]);
  });

  it("deleteFolder keeps the folder's boards, slotting them into its old spot in order", async () => {
    const store = seed(injectStore(), ['a', 'b', 'c', 'd'], {
      boards: { a: 'a0', b: 'a0', c: 'a1', d: 'a2' },
      folders: { f1: { name: 'Work', order: 'a1' } },
      boardFolders: { b: 'f1', c: 'f1' },
    });

    await store.deleteFolder('f1');

    const patch = lastPatch();
    expect(patch.folders).toEqual({ f1: null });
    expect(patch.boardFolders).toEqual({ b: null, c: null });
    expect(rootIds(store)).toEqual(['a', 'b', 'c', 'd']);
    expect(store.folders()).toEqual([]);
  });

  it('deleteFolder works for the last root item and ignores unknown ids', async () => {
    const store = seed(injectStore(), ['a', 'b'], {
      boards: { a: 'a0', b: 'a0' },
      folders: { f1: { name: 'Work', order: 'a1' } },
      boardFolders: { b: 'f1' },
    });

    await store.deleteFolder('missing');
    await store.deleteFolder('a'); // a board, not a folder
    expect(boardOrderService.updatePreferences).not.toHaveBeenCalled();

    await store.deleteFolder('f1');
    expect(rootIds(store)).toEqual(['a', 'b']);
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

  it('leaveBoard removes the current user from the board collaborators', async () => {
    const store = injectStore();

    await store.leaveBoard('board-1');

    expect(boardService.removeCollaborator).toHaveBeenCalledWith('board-1', 'u1');
  });

  it('throws when acting while signed out', async () => {
    userSignal.set(null);
    const store = injectStore();

    await expect(store.createBoard({ title: 'x' })).rejects.toThrow('Not authenticated');
    await expect(store.moveBoard('b1', null, 0)).rejects.toThrow('Not authenticated');
    await expect(store.leaveBoard('b1')).rejects.toThrow('Not authenticated');
  });

  it('isLoading reports false immediately when signed out', () => {
    userSignal.set(null);
    const store = injectStore();

    // Left side of the AND (`!!userId()`) short-circuits — isLoading stays false.
    expect(store.isLoading()).toBe(false);
  });
});
