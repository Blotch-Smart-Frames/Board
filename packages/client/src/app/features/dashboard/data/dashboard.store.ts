import { Injectable, computed, inject, resource } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, combineLatest, distinctUntilChanged, of, switchMap } from 'rxjs';
import { collection, onSnapshot } from 'firebase/firestore';
import { AuthStore } from '../../../core/auth/auth.store';
import { FIRESTORE_DB } from '../../../core/firebase/firebase.config';
import { UserService } from '../../../core/services/user.service';
import { UserBoardsStore, type BoardWithOrder } from '../../boards/data/user-boards.store';
import type { Collaborator, List, Task, User } from '../../../shared/types/board';

/** A task enriched with its owning board and list titles so dashboard views don't need cross-lookups. */
export type EnrichedTask = Task & {
  boardId: string;
  boardTitle: string;
  listTitle: string;
};

export type StatusBreakdownRow = {
  title: string;
  mine: number;
  total: number;
  share: number;
};

export type ActivityEvent = {
  id: string;
  kind: 'created' | 'completed';
  task: EnrichedTask;
  actorId: string;
  timestamp: Date;
};

const MS_PER_DAY = 86_400_000;
/** "Urgent" horizon — a ticket is urgent if it's due within this many days (or already overdue). */
const URGENT_WINDOW_DAYS = 3;

function isUrgentTask(task: EnrichedTask, now: number): boolean {
  if (task.completedAt) return false;
  const due = task.dueDate?.toDate?.().getTime();
  if (!due) return false;
  return due - now <= URGENT_WINDOW_DAYS * MS_PER_DAY;
}

/**
 * Aggregates tasks and lists across every board the signed-in user belongs to,
 * producing the metrics/breakdowns/activity feed the dashboard renders. Live via
 * per-board onSnapshot subscriptions that are re-established (through switchMap)
 * whenever the user's boards change, so a newly-shared board appears instantly.
 *
 * Provided at the dashboard route so listeners are torn down on navigation away.
 */
@Injectable()
export class DashboardStore {
  private readonly db = inject(FIRESTORE_DB);
  private readonly authStore = inject(AuthStore);
  private readonly userBoardsStore = inject(UserBoardsStore);
  private readonly userService = inject(UserService);

  readonly userId = computed(() => this.authStore.user()?.uid ?? null);
  readonly boards = computed<BoardWithOrder[]>(() => this.userBoardsStore.boards());
  readonly isLoadingBoards = computed(() => this.userBoardsStore.isLoading());

  // Only the set of board ids drives snapshot subscriptions — changes to a
  // board's order or title shouldn't tear down and re-open live listeners.
  private readonly boardIds = computed(() =>
    this.boards()
      .map((b) => b.id)
      .sort(),
  );

  private readonly boardIds$ = toObservable(this.boardIds).pipe(
    distinctUntilChanged((a, b) => a.length === b.length && a.every((id, i) => id === b[i])),
  );

  private readonly allTasks$ = this.boardIds$.pipe(
    switchMap((boardIds) => {
      if (boardIds.length === 0) return of<Array<Task & { boardId: string }>>([]);
      const streams = boardIds.map(
        (boardId) =>
          new Observable<Array<Task & { boardId: string }>>((subscriber) => {
            subscriber.next([]);
            return onSnapshot(
              collection(this.db, 'boards', boardId, 'tasks'),
              (snap) => {
                subscriber.next(
                  snap.docs.map(
                    (d) => ({ id: d.id, ...d.data(), boardId }) as Task & { boardId: string },
                  ),
                );
              },
              () => subscriber.next([]),
            );
          }),
      );
      return combineLatest(streams).pipe(switchMap((arrays) => of(arrays.flat())));
    }),
  );

  private readonly allLists$ = this.boardIds$.pipe(
    switchMap((boardIds) => {
      if (boardIds.length === 0) return of<Array<List & { boardId: string }>>([]);
      const streams = boardIds.map(
        (boardId) =>
          new Observable<Array<List & { boardId: string }>>((subscriber) => {
            subscriber.next([]);
            return onSnapshot(
              collection(this.db, 'boards', boardId, 'lists'),
              (snap) => {
                subscriber.next(
                  snap.docs.map(
                    (d) => ({ id: d.id, ...d.data(), boardId }) as List & { boardId: string },
                  ),
                );
              },
              () => subscriber.next([]),
            );
          }),
      );
      return combineLatest(streams).pipe(switchMap((arrays) => of(arrays.flat())));
    }),
  );

  private readonly rawTasks = toSignal(this.allTasks$, { initialValue: [] });
  private readonly rawLists = toSignal(this.allLists$, { initialValue: [] });

  readonly allTasks = computed<EnrichedTask[]>(() => {
    const boardTitles = new Map(this.boards().map((b) => [b.id, b.title]));
    const listTitles = new Map(this.rawLists().map((l) => [`${l.boardId}:${l.id}`, l.title]));
    return this.rawTasks().map((t) => ({
      ...t,
      boardTitle: boardTitles.get(t.boardId) ?? 'Unknown board',
      listTitle: listTitles.get(`${t.boardId}:${t.listId}`) ?? 'Unassigned',
    }));
  });

  readonly userTasks = computed<EnrichedTask[]>(() => {
    const uid = this.userId();
    if (!uid) return [];
    return this.allTasks().filter((t) => t.assignedTo?.includes(uid));
  });

  // Cache "now" as a computed to freeze urgency checks within a single render pass.
  private readonly now = computed(() => Date.now());

  readonly totalCount = computed(() => this.userTasks().length);
  readonly openCount = computed(() => this.userTasks().filter((t) => !t.completedAt).length);
  readonly answeredCount = computed(() => this.userTasks().filter((t) => !!t.completedAt).length);
  readonly urgentCount = computed(() => {
    const now = this.now();
    return this.userTasks().filter((t) => isUrgentTask(t, now)).length;
  });

  /** Grouped by list title across ALL boards, showing the user's share vs the total. */
  readonly statusBreakdown = computed<StatusBreakdownRow[]>(() => {
    const uid = this.userId();
    const rows = new Map<string, StatusBreakdownRow>();
    for (const task of this.allTasks()) {
      const key = task.listTitle;
      const existing = rows.get(key) ?? { title: key, mine: 0, total: 0, share: 0 };
      existing.total += 1;
      if (uid && task.assignedTo?.includes(uid)) existing.mine += 1;
      rows.set(key, existing);
    }
    for (const row of rows.values()) {
      row.share = row.total === 0 ? 0 : Math.round((row.mine / row.total) * 100);
    }
    return Array.from(rows.values()).sort((a, b) => b.total - a.total);
  });

  /** All urgent tickets, board-wide — sorted by earliest due date so the most pressing float to the top. */
  readonly urgentTickets = computed<EnrichedTask[]>(() => {
    const now = this.now();
    return this.allTasks()
      .filter((t) => isUrgentTask(t, now))
      .sort((a, b) => (a.dueDate?.toDate().getTime() ?? 0) - (b.dueDate?.toDate().getTime() ?? 0));
  });

  /** Only the current user's urgent tickets — used by the "Mine only" toggle in the urgent card. */
  readonly myUrgentTickets = computed<EnrichedTask[]>(() => {
    const uid = this.userId();
    if (!uid) return [];
    return this.urgentTickets().filter((t) => t.assignedTo?.includes(uid));
  });

  /**
   * Merges task create/complete events across every board into a single reverse-chronological feed.
   * Uses `createdAt` / `completedAt` timestamps we already have on the task doc rather than
   * spinning up a collectionGroup listener over per-task /history subcollections.
   */
  readonly recentActivity = computed<ActivityEvent[]>(() => {
    const events: ActivityEvent[] = [];
    for (const task of this.allTasks()) {
      const createdAt = task.createdAt?.toDate?.();
      if (createdAt) {
        events.push({
          id: `${task.id}-created`,
          kind: 'created',
          task,
          actorId: task.createdBy,
          timestamp: createdAt,
        });
      }
      const completedAt = task.completedAt?.toDate?.();
      if (completedAt) {
        events.push({
          id: `${task.id}-completed`,
          kind: 'completed',
          task,
          actorId: task.createdBy,
          timestamp: completedAt,
        });
      }
    }
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 12);
  });

  // Resolve every userId that shows up anywhere on the dashboard (assignees,
  // task creators, board owners/collaborators) into a full profile so avatars
  // and names render everywhere without individual fetches per component.
  private readonly allUserIds = computed(
    () => {
      const ids = new Set<string>();
      for (const task of this.allTasks()) {
        if (task.createdBy) ids.add(task.createdBy);
        for (const uid of task.assignedTo ?? []) ids.add(uid);
      }
      for (const board of this.boards()) {
        ids.add(board.ownerId);
        for (const c of board.collaborators) ids.add(c);
      }
      return Array.from(ids).sort();
    },
    // Avoid retriggering the users resource when the same id set is recomputed
    // (e.g. after a task drag reorder that doesn't touch assignees).
    { equal: (a, b) => a.length === b.length && a.every((id, i) => id === b[i]) },
  );

  private readonly usersResource = resource({
    params: () => {
      const ids = this.allUserIds();
      return ids.length > 0 ? { userIds: ids } : undefined;
    },
    loader: ({ params }) => this.userService.getUsersByIds(params.userIds),
  });

  private readonly profiles = computed<User[]>(() => this.usersResource.value() ?? []);

  /** Look up a user's display info by id — falls back to placeholders for unresolved ids. */
  readonly userDisplay = computed(() => {
    const profiles = this.profiles();
    const currentUser = this.authStore.user();
    return (userId: string): Collaborator => {
      const profile = profiles.find((p) => p.id === userId);
      if (profile) {
        return {
          id: profile.id,
          email: profile.email,
          name: profile.displayName || profile.email || 'User',
          photoURL: profile.photoURL ?? null,
          isOwner: false,
        };
      }
      if (currentUser && currentUser.uid === userId) {
        return {
          id: userId,
          email: currentUser.email ?? '',
          name: currentUser.displayName ?? 'You',
          photoURL: currentUser.photoURL,
          isOwner: false,
        };
      }
      return { id: userId, email: '', name: 'Unknown', photoURL: null, isOwner: false };
    };
  });
}
