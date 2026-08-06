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
import { BoardOrderService } from '../../../core/services/board-order.service';
import { docSignal, collectionSignal } from '../../../core/interop/signal-interop';
import { compareOrder, getOrderAtEnd, getOrderAtIndex } from '../../../shared/utils/ordering';
import type { Board, CreateBoardInput } from '../../../shared/types/board';

export type BoardWithOrder = Board & { order?: string };

function mergeBoards(
  owned: Board[],
  collaborated: Board[],
  orderMap: Record<string, string>,
): BoardWithOrder[] {
  const merged = new Map<string, Board>();
  for (const board of collaborated) merged.set(board.id, board);
  for (const board of owned) merged.set(board.id, board); // owned wins if it's somehow in both

  const boards: BoardWithOrder[] = Array.from(merged.values()).map((board) => ({
    ...board,
    order: orderMap[board.id],
  }));

  for (const board of boards) {
    if (board.order === undefined) {
      board.order = getOrderAtEnd(boards.filter((b) => b.order !== undefined));
    }
  }

  return boards.sort((a, b) => compareOrder(a.order, b.order));
}

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

  private readonly orderDocRef = computed<DocumentReference | null>(() => {
    const userId = this.currentUserId();
    return userId ? doc(this.db, 'users', userId, 'preferences', 'boardOrder') : null;
  });

  private readonly ownedBoards = collectionSignal<Board>(() => this.ownedQuery());
  private readonly collaboratedBoards = collectionSignal<Board>(() => this.collaboratedQuery());
  private readonly orderDoc = docSignal<{ boards?: Record<string, string> }>(() =>
    this.orderDocRef(),
  );

  // Optimistic reorder overlay, reset whenever the server's order doc echoes back.
  private readonly orderOverrides = linkedSignal<
    { boards?: Record<string, string> } | null | undefined,
    Map<string, string>
  >({ source: this.orderDoc, computation: () => new Map() });

  readonly isLoading = computed(() => !!this.currentUserId() && this.ownedBoards() === undefined);

  readonly boards = computed<BoardWithOrder[]>(() => {
    /* v8 ignore start -- defensive: signals are seeded to concrete values before boards() is consumed @preserve */
    const orderMap = {
      ...(this.orderDoc()?.boards ?? {}),
      ...Object.fromEntries(this.orderOverrides()),
    };
    return mergeBoards(this.ownedBoards() ?? [], this.collaboratedBoards() ?? [], orderMap);
    /* v8 ignore stop -- @preserve */
  });

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

  reorderBoard(boardId: string, newOrder: string): Promise<void> {
    return this.reorderBoards(new Map([[boardId, newOrder]]));
  }

  /**
   * Applies a batch of board order keys optimistically, then persists them,
   * rolling back the overrides if the write fails.
   */
  async reorderBoards(orders: Map<string, string>): Promise<void> {
    const userId = this.currentUserId();
    if (!userId) throw new Error('Not authenticated');
    if (orders.size === 0) return;
    this.orderOverrides.update((m) => {
      const next = new Map(m);
      for (const [id, order] of orders) next.set(id, order);
      return next;
    });
    try {
      await this.boardOrderService.setBoardOrders(userId, Object.fromEntries(orders));
    } catch (error) {
      this.orderOverrides.update((m) => {
        const next = new Map(m);
        for (const id of orders.keys()) next.delete(id);
        return next;
      });
      throw error;
    }
  }

  /** Computes the fractional order key for dropping a board at `targetIndex`, then reorders it. */
  reorderBoardToIndex(boardId: string, targetIndex: number): Promise<void> {
    const current = this.boards();
    const others = current.filter((b) => b.id !== boardId);
    const newOrder = getOrderAtIndex(others, targetIndex);

    // Persist the moved board *and* pin any sibling that has no stored order
    // yet. Un-stored boards get an "at the end" key synthesized on every render
    // (see mergeBoards). If we saved only the moved board, those siblings would
    // be re-synthesized past its new key and leapfrog it — which snaps a
    // downward drag back toward the top. Saving their current key fixes them in
    // place so the move sticks; once every board is stored this writes just the
    // moved one.
    const stored = this.orderDoc()?.boards ?? {};
    const orders = new Map<string, string>([[boardId, newOrder]]);
    for (const board of current) {
      if (board.id !== boardId && stored[board.id] === undefined && board.order !== undefined) {
        orders.set(board.id, board.order);
      }
    }
    return this.reorderBoards(orders);
  }
}
