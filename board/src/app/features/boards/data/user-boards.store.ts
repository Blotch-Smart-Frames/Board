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

  private readonly userId = computed(() => this.authStore.user()?.uid ?? null);

  private readonly ownedQuery = computed<Query | null>(() => {
    const userId = this.userId();
    return userId
      ? query(collection(this.db, 'boards'), where('ownerId', '==', userId), orderBy('createdAt', 'desc'))
      : null;
  });

  private readonly collaboratedQuery = computed<Query | null>(() => {
    const userId = this.userId();
    return userId ? query(collection(this.db, 'boards'), where('collaborators', 'array-contains', userId)) : null;
  });

  private readonly orderDocRef = computed<DocumentReference | null>(() => {
    const userId = this.userId();
    return userId ? doc(this.db, 'users', userId, 'preferences', 'boardOrder') : null;
  });

  private readonly ownedBoards = collectionSignal<Board>(() => this.ownedQuery());
  private readonly collaboratedBoards = collectionSignal<Board>(() => this.collaboratedQuery());
  private readonly orderDoc = docSignal<{ boards?: Record<string, string> }>(() => this.orderDocRef());

  // Optimistic reorder overlay, reset whenever the server's order doc echoes back.
  private readonly orderOverrides = linkedSignal<
    { boards?: Record<string, string> } | null | undefined,
    Map<string, string>
  >({ source: this.orderDoc, computation: () => new Map() });

  readonly isLoading = computed(() => !!this.userId() && this.ownedBoards() === undefined);

  readonly boards = computed<BoardWithOrder[]>(() => {
    const orderMap = { ...(this.orderDoc()?.boards ?? {}), ...Object.fromEntries(this.orderOverrides()) };
    return mergeBoards(this.ownedBoards() ?? [], this.collaboratedBoards() ?? [], orderMap);
  });

  async createBoard(input: CreateBoardInput): Promise<Board> {
    const userId = this.userId();
    if (!userId) throw new Error('Not authenticated');
    return this.boardService.createBoard(input, userId);
  }

  async renameBoard(boardId: string, title: string): Promise<void> {
    await this.boardService.updateBoard(boardId, { title });
  }

  async deleteBoard(boardId: string): Promise<void> {
    await this.boardService.deleteBoard(boardId);
  }

  async reorderBoard(boardId: string, newOrder: string): Promise<void> {
    const userId = this.userId();
    if (!userId) throw new Error('Not authenticated');
    this.orderOverrides.update((m) => new Map(m).set(boardId, newOrder));
    try {
      await this.boardOrderService.setBoardOrder(userId, boardId, newOrder);
    } catch (error) {
      this.orderOverrides.update((m) => {
        const next = new Map(m);
        next.delete(boardId);
        return next;
      });
      throw error;
    }
  }

  /** Computes the fractional order key for dropping a board at `targetIndex`, then reorders it. */
  reorderBoardToIndex(boardId: string, targetIndex: number): Promise<void> {
    const others = this.boards().filter((b) => b.id !== boardId);
    const newOrder = getOrderAtIndex(others, targetIndex);
    return this.reorderBoard(boardId, newOrder);
  }
}
