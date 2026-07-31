import { Injectable, inject, computed, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import {
  collection,
  doc,
  orderBy,
  query,
  type CollectionReference,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';
import { FIRESTORE_DB } from '../../../core/firebase/firebase.config';
import { AuthStore } from '../../../core/auth/auth.store';
import { BoardService } from '../../../core/services/board.service';
import { docSignal, collectionSignal } from '../../../core/interop/signal-interop';
import { collaboratorsResource } from '../../../core/interop/collaborators-resource';
import { diffTaskChanges } from '../../../shared/utils/task-history-diff';
import { compareOrder, getOrderAtIndex, getOrderAtEnd } from '../../../shared/utils/ordering';
import type {
  Board,
  List,
  Task,
  Label,
  Sprint,
  CreateListInput,
  UpdateListInput,
  CreateTaskInput,
  UpdateTaskInput,
} from '../../../shared/types/board';

/**
 * Live data for whichever board is active on the current route. Provided at
 * the board workspace route (not root @Service()) so its onSnapshot
 * listeners are created once per board-route-activation and torn down on
 * navigation away, instead of every consumer opening its own subscription.
 */
@Injectable()
export class BoardStore {
  private readonly db = inject(FIRESTORE_DB);
  private readonly route = inject(ActivatedRoute);
  private readonly authStore = inject(AuthStore);
  private readonly boardService = inject(BoardService);

  readonly boardId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('boardId'))),
    { initialValue: null },
  );

  private readonly boardRef = computed<DocumentReference | null>(() => {
    const boardId = this.boardId();
    return boardId ? doc(this.db, 'boards', boardId) : null;
  });

  private readonly listsQuery = computed<Query | null>(() => {
    const boardId = this.boardId();
    return boardId ? query(collection(this.db, 'boards', boardId, 'lists'), orderBy('order')) : null;
  });

  private readonly tasksQuery = computed<CollectionReference | null>(() => {
    const boardId = this.boardId();
    return boardId ? collection(this.db, 'boards', boardId, 'tasks') : null;
  });

  private readonly labelsQuery = computed<Query | null>(() => {
    const boardId = this.boardId();
    return boardId ? query(collection(this.db, 'boards', boardId, 'labels'), orderBy('order')) : null;
  });

  private readonly sprintsQuery = computed<Query | null>(() => {
    const boardId = this.boardId();
    return boardId ? query(collection(this.db, 'boards', boardId, 'sprints'), orderBy('order')) : null;
  });

  readonly board = docSignal<Board>(() => this.boardRef());
  readonly lists = collectionSignal<List>(() => this.listsQuery());
  readonly tasks = collectionSignal<Task>(() => this.tasksQuery());
  readonly labels = collectionSignal<Label>(() => this.labelsQuery());
  readonly sprints = collectionSignal<Sprint>(() => this.sprintsQuery());

  readonly collaborators = collaboratorsResource(
    () => this.board(),
    () => this.authStore.user(),
  );

  readonly isLoading = computed(() => !!this.boardId() && this.board() === undefined);

  /** Board-wide filters applied in `listsWithTasks`, mirroring the source app's Board.tsx filteredTasks. */
  readonly assigneeFilter = signal<string | null>(null);
  readonly labelFilter = signal<string[]>([]);

  // Optimistic drag overrides, applied on top of the live Firestore data so a
  // reorder shows instantly instead of snapping back until the snapshot echoes.
  // linkedSignal resets them to empty whenever fresh server data arrives, which
  // also serves as the "server confirmed" cleanup.
  private readonly taskOverrides = linkedSignal<
    Task[] | undefined,
    Map<string, { listId: string; order: string }>
  >({ source: this.tasks, computation: () => new Map() });
  private readonly listOverrides = linkedSignal<List[] | undefined, Map<string, string>>({
    source: this.lists,
    computation: () => new Map(),
  });

  /** Lists sorted by fractional order, each with its tasks (also order-sorted). */
  readonly listsWithTasks = computed(() => {
    const listOverrides = this.listOverrides();
    const taskOverrides = this.taskOverrides();
    const assigneeFilter = this.assigneeFilter();
    const labelFilter = this.labelFilter();

    const lists = (this.lists() ?? []).map((list) => ({
      ...list,
      order: listOverrides.get(list.id) ?? list.order,
    }));
    const tasks = (this.tasks() ?? [])
      .map((task) => {
        const override = taskOverrides.get(task.id);
        return override ? { ...task, listId: override.listId, order: override.order } : task;
      })
      .filter((task) => !assigneeFilter || task.assignedTo?.includes(assigneeFilter))
      .filter((task) => labelFilter.length === 0 || task.labelIds?.some((id) => labelFilter.includes(id)));

    return lists
      .sort((a, b) => compareOrder(a.order, b.order))
      .map((list) => ({
        ...list,
        tasks: tasks
          .filter((task) => task.listId === list.id)
          .sort((a, b) => compareOrder(a.order, b.order)),
      }));
  });

  private requireBoardId(): string {
    const boardId = this.boardId();
    if (!boardId) throw new Error('No board selected');
    return boardId;
  }

  // --- List mutations ---

  addList(input: CreateListInput): Promise<List> {
    return this.boardService.addList(this.requireBoardId(), input);
  }

  updateListTitle(listId: string, input: UpdateListInput): Promise<void> {
    return this.boardService.updateList(this.requireBoardId(), listId, input);
  }

  deleteList(listId: string): Promise<void> {
    return this.boardService.deleteList(this.requireBoardId(), listId);
  }

  async reorderList(listId: string, newOrder: string): Promise<void> {
    this.listOverrides.update((m) => new Map(m).set(listId, newOrder));
    try {
      await this.boardService.reorderLists(this.requireBoardId(), listId, newOrder);
    } catch (error) {
      this.listOverrides.update((m) => {
        const next = new Map(m);
        next.delete(listId);
        return next;
      });
      throw error;
    }
  }

  // --- Task mutations ---

  addTask(listId: string, input: CreateTaskInput): Promise<Task> {
    const userId = this.authStore.user()?.uid;
    if (!userId) throw new Error('Not authenticated');
    return this.boardService.addTask(this.requireBoardId(), listId, input, userId);
  }

  /** Updates a task and records field-change history (labels/assignees/dates/etc.). */
  async updateTask(taskId: string, updates: UpdateTaskInput): Promise<void> {
    const boardId = this.requireBoardId();
    const existing = (this.tasks() ?? []).find((t) => t.id === taskId);
    await this.boardService.updateTask(boardId, taskId, updates);

    const userId = this.authStore.user()?.uid;
    if (existing && userId) {
      const entries = diffTaskChanges(existing, updates, {
        userId,
        labels: this.labels() ?? [],
        collaborators: this.collaborators(),
        lists: this.lists() ?? [],
        sprints: this.sprints() ?? [],
      });
      if (entries.length > 0) {
        this.boardService.addTaskHistory(boardId, taskId, entries).catch(() => {});
      }
    }
  }

  deleteTask(taskId: string): Promise<void> {
    return this.boardService.deleteTask(this.requireBoardId(), taskId);
  }

  /** Toggles completion and records a completed/reopened history entry. */
  async setTaskCompleted(taskId: string, completed: boolean): Promise<void> {
    const boardId = this.requireBoardId();
    const existing = (this.tasks() ?? []).find((t) => t.id === taskId);
    const wasCompleted = !!existing?.completedAt;
    await this.boardService.updateTask(boardId, taskId, {
      completedAt: completed ? new Date() : null,
    });

    const userId = this.authStore.user()?.uid;
    if (userId && wasCompleted !== completed) {
      this.boardService
        .addTaskHistory(boardId, taskId, [{ action: completed ? 'completed' : 'reopened', userId }])
        .catch(() => {});
    }
  }

  async moveTask(taskId: string, newListId: string, newOrder: string): Promise<void> {
    const boardId = this.requireBoardId();
    const task = (this.tasks() ?? []).find((t) => t.id === taskId);
    const listChanged = !!task && task.listId !== newListId;

    this.taskOverrides.update((m) => new Map(m).set(taskId, { listId: newListId, order: newOrder }));

    try {
      await this.boardService.moveTask(boardId, taskId, newListId, newOrder);
    } catch (error) {
      this.taskOverrides.update((m) => {
        const next = new Map(m);
        next.delete(taskId);
        return next;
      });
      throw error;
    }

    const userId = this.authStore.user()?.uid;
    if (task && userId && listChanged) {
      const lists = this.lists() ?? [];
      const fromList = lists.find((l) => l.id === task.listId);
      const toList = lists.find((l) => l.id === newListId);
      this.boardService
        .addTaskHistory(boardId, taskId, [
          {
            action: 'moved',
            userId,
            metadata: { fromListName: fromList?.title ?? '', toListName: toList?.title ?? '' },
          },
        ])
        .catch(() => {});
    }
  }

  /** Moves a task to the end of a different list (e.g. from the task detail dialog's "List" select). */
  moveTaskToList(taskId: string, newListId: string): Promise<void> {
    const tasks = this.tasks() ?? [];
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.listId === newListId) return Promise.resolve();
    const targetListTasks = tasks.filter((t) => t.listId === newListId);
    return this.moveTask(taskId, newListId, getOrderAtEnd(targetListTasks));
  }

  /**
   * Computes the fractional order key for dropping a task at `targetIndex`
   * within `destListId` (CDK gives an index, not neighbor ids), then moves it.
   * Works for both same-list reorder and cross-list moves.
   */
  moveTaskToIndex(taskId: string, destListId: string, targetIndex: number): Promise<void> {
    const destList = this.listsWithTasks().find((l) => l.id === destListId);
    const destTasks = (destList?.tasks ?? []).filter((t) => t.id !== taskId && !t.completedAt);
    const newOrder = getOrderAtIndex(destTasks, targetIndex);
    return this.moveTask(taskId, destListId, newOrder);
  }

  /** Computes the fractional order key for dropping a list at `targetIndex`, then reorders it. */
  reorderListToIndex(listId: string, targetIndex: number): Promise<void> {
    const others = this.listsWithTasks().filter((l) => l.id !== listId);
    const newOrder = getOrderAtIndex(others, targetIndex);
    return this.reorderList(listId, newOrder);
  }
}
