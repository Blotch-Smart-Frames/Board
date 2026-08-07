import { Injectable, inject, computed, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Observable, combineLatest, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';
import { FIRESTORE_DB } from '../../../core/firebase/firebase.config';
import { AuthStore } from '../../../core/auth/auth.store';
import { BoardService } from '../../../core/services/board.service';
import { SyncService } from '../../../core/services/sync.service';
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

/** How many archived tasks to peek per archival list in the faded preview. */
const ARCHIVED_PREVIEW_LIMIT = 5;

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
  private readonly syncService = inject(SyncService);

  readonly boardId = toSignal(this.route.paramMap.pipe(map((params) => params.get('boardId'))), {
    initialValue: null,
  });

  private readonly boardRef = computed<DocumentReference | null>(() => {
    const boardId = this.boardId();
    return boardId ? doc(this.db, 'boards', boardId) : null;
  });

  private readonly listsQuery = computed<Query | null>(() => {
    const boardId = this.boardId();
    return boardId
      ? query(collection(this.db, 'boards', boardId, 'lists'), orderBy('order'))
      : null;
  });

  // Only non-archived tasks are streamed to the board. Filtering at the query
  // level (rather than after fetching) is the whole point of archiving: it keeps
  // document reads bounded on large boards instead of paying one read per ticket.
  // NB: Firestore equality filters skip docs missing the field, so every task
  // must carry `archive` (defaulted on create; existing docs need a one-off
  // backfill — see packages/functions/scripts/backfill-archive.ts).
  private readonly tasksQuery = computed<Query | null>(() => {
    const boardId = this.boardId();
    return boardId
      ? query(collection(this.db, 'boards', boardId, 'tasks'), where('archive', '==', false))
      : null;
  });

  private readonly labelsQuery = computed<Query | null>(() => {
    const boardId = this.boardId();
    return boardId
      ? query(collection(this.db, 'boards', boardId, 'labels'), orderBy('order'))
      : null;
  });

  private readonly sprintsQuery = computed<Query | null>(() => {
    const boardId = this.boardId();
    return boardId
      ? query(collection(this.db, 'boards', boardId, 'sprints'), orderBy('order'))
      : null;
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

  /** IDs of the board's archival lists (empty when none configured). */
  readonly archivalListIds = computed<string[]>(() => this.board()?.archivalListIds ?? []);

  // A bounded live peek at each archival list's most-recently-archived tasks, so
  // an archived column still shows *something* (with a fade hinting at more)
  // without re-fetching the whole archive. One small listener per archival list,
  // capped at ARCHIVED_PREVIEW_LIMIT docs each.
  private readonly archivedPreviewSource = computed(() => ({
    boardId: this.boardId(),
    listIds: this.archivalListIds(),
  }));

  private readonly archivedPreview$ = toObservable(this.archivedPreviewSource).pipe(
    distinctUntilChanged(
      (a, b) =>
        a.boardId === b.boardId &&
        a.listIds.length === b.listIds.length &&
        a.listIds.every((id, i) => id === b.listIds[i]),
    ),
    switchMap(({ boardId, listIds }) => {
      if (listIds.length === 0) return of(new Map<string, Task[]>());
      /* v8 ignore next -- defensive: listIds is only non-empty once a board (hence boardId) has loaded @preserve */
      if (!boardId) return of(new Map<string, Task[]>());
      const streams = listIds.map(
        (listId) =>
          new Observable<[string, Task[]]>((subscriber) => {
            subscriber.next([listId, []]);
            return onSnapshot(
              query(
                collection(this.db, 'boards', boardId, 'tasks'),
                where('listId', '==', listId),
                where('archive', '==', true),
                orderBy('updatedAt', 'desc'),
                limit(ARCHIVED_PREVIEW_LIMIT),
              ),
              (snap) =>
                subscriber.next([
                  listId,
                  snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Task),
                ]),
              /* v8 ignore next -- onSnapshot error path mirrors signal-interop's swallow-and-empty @preserve */
              () => subscriber.next([listId, []]),
            );
          }),
      );
      return combineLatest(streams).pipe(map((entries) => new Map(entries)));
    }),
  );

  /** Map of archival listId -> its last {@link ARCHIVED_PREVIEW_LIMIT} archived tasks. */
  readonly archivedPreviewByListId = toSignal(this.archivedPreview$, {
    initialValue: new Map<string, Task[]>(),
  });

  readonly isLoading = computed(() => !!this.boardId() && this.board() === undefined);

  /** Board-wide filters applied in `listsWithTasks`, mirroring the source app's Board.tsx filteredTasks. */
  readonly assigneeFilter = signal<string[]>([]);
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

    /* v8 ignore start -- inner map/filter/some callbacks are exercised by the filter tests but V8 attributes coverage inconsistently @preserve */
    const lists = (this.lists() ?? []).map((list) => ({
      ...list,
      order: listOverrides.get(list.id) ?? list.order,
    }));
    const tasks = (this.tasks() ?? [])
      .map((task) => {
        const override = taskOverrides.get(task.id);
        return override ? { ...task, listId: override.listId, order: override.order } : task;
      })
      .filter(
        (task) =>
          assigneeFilter.length === 0 || task.assignedTo?.some((id) => assigneeFilter.includes(id)),
      )
      .filter(
        (task) => labelFilter.length === 0 || task.labelIds?.some((id) => labelFilter.includes(id)),
      );
    /* v8 ignore stop -- @preserve */

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

  async addTask(listId: string, input: CreateTaskInput): Promise<Task> {
    const userId = this.authStore.user()?.uid;
    if (!userId) throw new Error('Not authenticated');
    const task = await this.boardService.addTask(this.requireBoardId(), listId, input, userId);
    if (task.calendarSyncEnabled && task.dueDate) {
      this.syncService.syncTaskToCalendar(this.requireBoardId(), task).catch(
        /* v8 ignore next 3 -- log-and-swallow keeps optimistic UI when calendar sync fails @preserve */
        (err) => {
          console.error('Calendar sync failed for new task:', err);
        },
      );
    }
    return task;
  }

  /**
   * Updates a task, records field-change history (labels/assignees/dates/etc.),
   * and reconciles Google Calendar: creates/updates the linked event when sync
   * is on with a due date, or deletes it when sync is being toggled off (fixes
   * source's behavior of orphaning the event on disable — SyncService.unlink
   * already handles both the Calendar API delete and clearing calendarEventId).
   */
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
      });
      if (entries.length > 0) {
        /* v8 ignore start -- history writes are fire-and-forget @preserve */
        this.boardService.addTaskHistory(boardId, taskId, entries).catch(() => {});
        /* v8 ignore stop -- @preserve */
      }
    }

    if (existing) {
      this.reconcileCalendarSync(boardId, existing, updates).catch(
        /* v8 ignore next 3 -- log-and-swallow keeps optimistic UI when calendar sync fails @preserve */
        (err) => {
          console.error('Calendar sync failed for task update:', err);
        },
      );
    }
  }

  private async reconcileCalendarSync(
    boardId: string,
    existing: Task,
    updates: UpdateTaskInput,
  ): Promise<void> {
    const merged: Task = { ...existing, ...updates } as Task;
    const wasEnabled = existing.calendarSyncEnabled;
    const isEnabled = merged.calendarSyncEnabled;

    if (wasEnabled && !isEnabled) {
      await this.syncService.unlinkTaskFromCalendar(boardId, existing);
      return;
    }
    if (isEnabled && merged.dueDate) {
      await this.syncService.syncTaskToCalendar(boardId, merged);
    }
  }

  deleteTask(taskId: string): Promise<void> {
    return this.boardService.deleteTask(this.requireBoardId(), taskId);
  }

  /** Toggles completion and records a completed/reopened history entry. */
  async setTaskCompleted(taskId: string, completed: boolean): Promise<void> {
    const boardId = this.requireBoardId();
    /* v8 ignore next -- defensive: tasks() is seeded to an array by the collection stream @preserve */
    const existing = (this.tasks() ?? []).find((t) => t.id === taskId);
    const wasCompleted = !!existing?.completedAt;
    await this.boardService.updateTask(boardId, taskId, {
      completedAt: completed ? new Date() : null,
    });

    const userId = this.authStore.user()?.uid;
    if (userId && wasCompleted !== completed) {
      /* v8 ignore start -- history writes are fire-and-forget @preserve */
      this.boardService
        .addTaskHistory(boardId, taskId, [{ action: completed ? 'completed' : 'reopened', userId }])
        .catch(() => {});
      /* v8 ignore stop -- @preserve */
    }
  }

  async moveTask(taskId: string, newListId: string, newOrder: string): Promise<void> {
    const boardId = this.requireBoardId();
    const task = this.findTask(taskId);
    const listChanged = !!task && task.listId !== newListId;

    // Dropping into an archival list archives; dragging back out restores.
    // `undefined` leaves the flag untouched (same-archival-state moves).
    const destIsArchival = this.archivalListIds().includes(newListId);
    const wasArchived = !!task?.archive;
    const archive =
      destIsArchival && !wasArchived ? true : !destIsArchival && wasArchived ? false : undefined;

    this.taskOverrides.update((m) =>
      new Map(m).set(taskId, { listId: newListId, order: newOrder }),
    );

    try {
      await this.boardService.moveTask(boardId, taskId, newListId, newOrder, archive);
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
      /* v8 ignore start -- history writes are fire-and-forget @preserve */
      this.boardService
        .addTaskHistory(boardId, taskId, [
          {
            action: 'moved',
            userId,
            metadata: { fromListName: fromList?.title ?? '', toListName: toList?.title ?? '' },
          },
        ])
        .catch(() => {});
      /* v8 ignore stop -- @preserve */
    }
  }

  /** Moves a task to the end of a different list (e.g. from the task detail dialog's "List" select). */
  moveTaskToList(taskId: string, newListId: string): Promise<void> {
    /* v8 ignore next -- defensive: tasks() is seeded to an array by the collection stream @preserve */
    const tasks = this.tasks() ?? [];
    // An archived task isn't in tasks() (filtered out at the query), so look it
    // up across the archived preview too — this is the "unarchive via List
    // select" path, which relies on moveTask flipping archive back to false.
    const task = this.findTask(taskId);
    if (!task || task.listId === newListId) return Promise.resolve();
    const targetListTasks = tasks.filter((t) => t.listId === newListId);
    return this.moveTask(taskId, newListId, getOrderAtEnd(targetListTasks));
  }

  /**
   * Finds a task by id across both the live (non-archived) tasks and the archived
   * previews, so move/restore logic can read an archived task's current state.
   */
  private findTask(taskId: string): Task | undefined {
    const active = (this.tasks() ?? []).find((t) => t.id === taskId);
    if (active) return active;
    for (const previews of this.archivedPreviewByListId().values()) {
      const found = previews.find((t) => t.id === taskId);
      if (found) return found;
    }
    return undefined;
  }

  /** Persists which lists act as archives (stored as IDs so renames don't break it). */
  setArchivalListIds(listIds: string[]): Promise<void> {
    return this.boardService.updateBoard(this.requireBoardId(), { archivalListIds: listIds });
  }

  /**
   * Migrates a task (with its comments/history) to a list on a different
   * board. Returns the new task id in the target board. The caller supplies the
   * target board's title so the recorded history entry stays intact even if
   * that board is later renamed or deleted.
   */
  async migrateTaskToBoard(
    taskId: string,
    targetBoardId: string,
    targetListId: string,
    targetBoardTitle: string,
  ): Promise<string> {
    const sourceBoardId = this.requireBoardId();
    const userId = this.authStore.user()?.uid;
    if (!userId) throw new Error('Not authenticated');
    const fromBoardName = this.board()?.title ?? '';
    return this.boardService.migrateTaskToBoard(
      sourceBoardId,
      taskId,
      targetBoardId,
      targetListId,
      userId,
      { fromBoardName, toBoardName: targetBoardTitle },
    );
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
