import { Service, inject, computed, linkedSignal } from '@angular/core';
import {
  collection,
  doc,
  orderBy,
  query,
  where,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';
import { FIRESTORE_DB } from '../../../core/firebase/firebase.config';
import { AuthStore } from '../../../core/auth/auth.store';
import { BoardService } from '../../../core/services/board.service';
import {
  BoardOrderService,
  type BoardPreferences,
  type BoardPreferencesPatch,
} from '../../../core/services/board-order.service';
import { docSignal, collectionSignal } from '../../../core/interop/signal-interop';
import { getOrderAtEnd, getOrderAtIndex, getOrdersBetween } from '../../../shared/utils/ordering';
import type { Board, CreateBoardInput } from '../../../shared/types/board';
import {
  applyPreferencesPatch,
  buildSidebarTree,
  flattenSidebarTree,
  orderOf,
  type BoardFolder,
  type FolderNode,
  type SidebarNode,
} from './board-tree';

export type { BoardWithOrder, BoardFolder, BoardNode, FolderNode, SidebarNode } from './board-tree';

function mergeBoards(owned: Board[], collaborated: Board[]): Board[] {
  const merged = new Map<string, Board>();
  for (const board of collaborated) merged.set(board.id, board);
  for (const board of owned) merged.set(board.id, board); // owned wins if it's somehow in both
  return Array.from(merged.values());
}

const toOrdered = (nodes: SidebarNode[]) => nodes.map((node) => ({ order: orderOf(node) }));

/** The signed-in user's boards: owned + shared-with-them, merged with their saved sidebar order. */
@Service()
export class UserBoardsStore {
  private readonly db = inject(FIRESTORE_DB);
  private readonly authStore = inject(AuthStore);
  private readonly boardService = inject(BoardService);
  private readonly boardOrderService = inject(BoardOrderService);

  readonly currentUserId = computed(() => this.authStore.user()?.uid ?? null);

  private readonly ownedQuery = computed<Query | null>(() => {
    const userId = this.currentUserId();
    return userId
      ? query(
          collection(this.db, 'boards'),
          where('ownerId', '==', userId),
          orderBy('createdAt', 'desc'),
        )
      : null;
  });

  private readonly collaboratedQuery = computed<Query | null>(() => {
    const userId = this.currentUserId();
    return userId
      ? query(collection(this.db, 'boards'), where('collaborators', 'array-contains', userId))
      : null;
  });

  private readonly preferencesDocRef = computed<DocumentReference | null>(() => {
    const userId = this.currentUserId();
    return userId ? doc(this.db, 'users', userId, 'preferences', 'boardOrder') : null;
  });

  private readonly ownedBoards = collectionSignal<Board>(() => this.ownedQuery());
  private readonly collaboratedBoards = collectionSignal<Board>(() => this.collaboratedQuery());
  private readonly preferencesDoc = docSignal<BoardPreferences>(() => this.preferencesDocRef());

  // Optimistic layout changes, cleared whenever the server's preferences doc echoes back.
  private readonly pendingPatches = linkedSignal<
    BoardPreferences | null | undefined,
    BoardPreferencesPatch[]
  >({ source: this.preferencesDoc, computation: () => [] });

  private readonly preferences = computed(() =>
    this.pendingPatches().reduce(applyPreferencesPatch, this.preferencesDoc() ?? {}),
  );

  readonly isLoading = computed(() => !!this.currentUserId() && this.ownedBoards() === undefined);

  /** The sidebar tree: folders (each with its boards) and loose boards, in display order. */
  readonly sidebar = computed<SidebarNode[]>(() =>
    buildSidebarTree(
      mergeBoards(this.ownedBoards() ?? [], this.collaboratedBoards() ?? []),
      this.preferences(),
    ),
  );

  /** Every board the user can open, flattened in sidebar order. */
  readonly boards = computed(() => flattenSidebarTree(this.sidebar()));

  readonly folders = computed<BoardFolder[]>(() =>
    this.sidebar()
      .filter((node): node is FolderNode => node.kind === 'folder')
      .map((node) => node.folder),
  );

  async createBoard(input: CreateBoardInput): Promise<Board> {
    const userId = this.currentUserId();
    if (!userId) throw new Error('Not authenticated');
    return this.boardService.createBoard(input, userId);
  }

  async renameBoard(boardId: string, title: string): Promise<void> {
    await this.boardService.updateBoard(boardId, { title });
  }

  async deleteBoard(boardId: string): Promise<void> {
    await this.boardService.deleteBoard(boardId);
  }

  /**
   * Removes the current user from a board they collaborate on (but don't own).
   * Owners delete boards; collaborators leave them. The board and its contents
   * stay intact for everyone else.
   */
  async leaveBoard(boardId: string): Promise<void> {
    const userId = this.currentUserId();
    if (!userId) throw new Error('Not authenticated');
    await this.boardService.removeCollaborator(boardId, userId);
  }

  /** Moves a board to `index` within a folder, or within the root when `folderId` is null. */
  moveBoard(boardId: string, folderId: string | null, index: number): Promise<void> {
    const siblings = this.childrenOf(folderId).filter((node) => node.id !== boardId);
    return this.updatePreferences({
      boards: {
        ...this.pinUnstored(siblings),
        [boardId]: getOrderAtIndex(toOrdered(siblings), index),
      },
      boardFolders: { [boardId]: folderId },
    });
  }

  /**
   * Files a board at the end of a folder, or — with `folderId` null — takes it
   * out of its folder and places it just below that folder.
   */
  moveBoardToFolder(boardId: string, folderId: string | null): Promise<void> {
    if (folderId) return this.moveBoard(boardId, folderId, this.childrenOf(folderId).length);

    const currentFolderId = this.boardNode(boardId)?.folderId;
    if (!currentFolderId) return Promise.resolve();
    const folderIndex = this.sidebar().findIndex((node) => node.id === currentFolderId);
    return this.moveBoard(boardId, null, folderIndex + 1);
  }

  /** Moves a folder to `index` among the root-level folders and boards. */
  moveFolder(folderId: string, index: number): Promise<void> {
    const siblings = this.sidebar().filter((node) => node.id !== folderId);
    return this.updatePreferences({
      boards: this.pinUnstored(siblings),
      folders: { [folderId]: { order: getOrderAtIndex(toOrdered(siblings), index) } },
    });
  }

  /** Creates an empty folder at the bottom of the sidebar and resolves with its id. */
  async createFolder(name: string): Promise<string> {
    const id = crypto.randomUUID();
    const root = this.sidebar();
    await this.updatePreferences({
      boards: this.pinUnstored(root),
      folders: { [id]: { name, order: getOrderAtEnd(toOrdered(root)), collapsed: false } },
    });
    return id;
  }

  renameFolder(folderId: string, name: string): Promise<void> {
    return this.updatePreferences({ folders: { [folderId]: { name } } });
  }

  setFolderCollapsed(folderId: string, collapsed: boolean): Promise<void> {
    return this.updatePreferences({ folders: { [folderId]: { collapsed } } });
  }

  /**
   * Deletes a folder but keeps its boards: they move back to the root, in the
   * folder's old spot and in the same order they had inside it.
   */
  deleteFolder(folderId: string): Promise<void> {
    const root = this.sidebar();
    const index = root.findIndex((node) => node.id === folderId);
    const folder = root[index];
    if (folder?.kind !== 'folder') return Promise.resolve();

    const next = root[index + 1];
    const keys = getOrdersBetween(
      folder.folder.order,
      next ? orderOf(next) : null,
      folder.boards.length,
    );
    const boards = this.pinUnstored(root);
    const boardFolders: Record<string, null> = {};
    folder.boards.forEach((child, i) => {
      boards[child.id] = keys[i];
      boardFolders[child.id] = null;
    });
    return this.updatePreferences({ boards, boardFolders, folders: { [folderId]: null } });
  }

  private childrenOf(folderId: string | null): SidebarNode[] {
    if (folderId === null) return this.sidebar();
    const folder = this.sidebar().find((node) => node.id === folderId);
    return folder?.kind === 'folder' ? folder.boards : [];
  }

  private boardNode(boardId: string) {
    return this.sidebar()
      .flatMap((node) => (node.kind === 'folder' ? node.boards : [node]))
      .find((node) => node.id === boardId);
  }

  /**
   * Root boards with no stored key get an "at the end" key synthesized on every
   * render (see buildSidebarTree). If a write saved only the moved item, those
   * siblings would be re-synthesized past its new key and leapfrog it — which
   * snaps a downward drag back toward the top, or buries a new folder above
   * them. Saving their current key with the write fixes them in place; once
   * every board is stored this adds nothing.
   */
  private pinUnstored(siblings: SidebarNode[]): Record<string, string> {
    const stored = this.preferences().boards ?? {};
    const pins: Record<string, string> = {};
    for (const node of siblings) {
      if (node.kind === 'board' && stored[node.id] === undefined) pins[node.id] = node.board.order;
    }
    return pins;
  }

  /** Applies a layout change optimistically, then persists it, rolling back if the write fails. */
  private async updatePreferences(patch: BoardPreferencesPatch): Promise<void> {
    const userId = this.currentUserId();
    if (!userId) throw new Error('Not authenticated');
    this.pendingPatches.update((patches) => [...patches, patch]);
    try {
      await this.boardOrderService.updatePreferences(userId, patch);
    } catch (error) {
      this.pendingPatches.update((patches) => patches.filter((p) => p !== patch));
      throw error;
    }
  }
}
