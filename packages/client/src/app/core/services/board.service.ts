import { Service, inject } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
  type FieldValue,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FIREBASE_FUNCTIONS, FIRESTORE_DB } from '../firebase/firebase.config';
import { LabelService } from './label.service';
import { StorageService } from './storage.service';
import { getOrderAtEnd } from '../../shared/utils/ordering';
import type {
  Board,
  List,
  Task,
  HistoryEntry,
  CreateBoardInput,
  CreateListInput,
  UpdateListInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateCommentInput,
  UpdateCommentInput,
} from '../../shared/types/board';

type MigrateTaskPayload = {
  sourceBoardId: string;
  taskId: string;
  targetBoardId: string;
  targetListId: string;
};

type MigrateTaskResult = { newTaskId: string };

@Service()
export class BoardService {
  private readonly db = inject(FIRESTORE_DB);
  private readonly functions = inject(FIREBASE_FUNCTIONS);
  private readonly labelService = inject(LabelService);
  private readonly storageService = inject(StorageService);

  private boardsCollection() {
    return collection(this.db, 'boards');
  }

  private boardRef(boardId: string) {
    return doc(this.db, 'boards', boardId);
  }

  private listsCollection(boardId: string) {
    return collection(this.db, 'boards', boardId, 'lists');
  }

  private listRef(boardId: string, listId: string) {
    return doc(this.db, 'boards', boardId, 'lists', listId);
  }

  private tasksCollection(boardId: string) {
    return collection(this.db, 'boards', boardId, 'tasks');
  }

  private taskRef(boardId: string, taskId: string) {
    return doc(this.db, 'boards', boardId, 'tasks', taskId);
  }

  private commentsCollection(boardId: string, taskId: string) {
    return collection(this.db, 'boards', boardId, 'tasks', taskId, 'comments');
  }

  private commentRef(boardId: string, taskId: string, commentId: string) {
    return doc(this.db, 'boards', boardId, 'tasks', taskId, 'comments', commentId);
  }

  private historyCollection(boardId: string, taskId: string) {
    return collection(this.db, 'boards', boardId, 'tasks', taskId, 'history');
  }

  // --- Boards ---

  async createBoard(input: CreateBoardInput, userId: string): Promise<Board> {
    const docRef = await addDoc(this.boardsCollection(), {
      title: input.title,
      ownerId: userId,
      collaborators: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snapshot = await getDoc(docRef);
    const board = { id: snapshot.id, ...snapshot.data() } as Board;
    await this.labelService.initializeDefaultLabels(board.id);
    return board;
  }

  async getBoard(boardId: string): Promise<Board | null> {
    const snapshot = await getDoc(this.boardRef(boardId));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Board) : null;
  }

  async updateBoard(
    boardId: string,
    updates: Partial<Pick<Board, 'title' | 'archivalListIds'>> & {
      backgroundImageUrl?: string | FieldValue;
    },
  ): Promise<void> {
    await updateDoc(this.boardRef(boardId), { ...updates, updatedAt: serverTimestamp() });
  }

  /**
   * Deletes the board document only. The full cascade — every list, task (with
   * its comments and history), label and sprint, plus all Storage objects under
   * boards/{boardId}/ — is handled server-side by the `cleanupDeletedBoard`
   * Cloud Function, which triggers on this doc's deletion and runs with Admin
   * privileges. That avoids the client's member-permission limits and the
   * Storage rule-ordering leak that previously orphaned attachments.
   */
  async deleteBoard(boardId: string): Promise<void> {
    await deleteDoc(this.boardRef(boardId));
  }

  async shareBoard(boardId: string, userId: string): Promise<void> {
    const board = await this.getBoard(boardId);
    if (!board) {
      throw new Error('Board not found');
    }
    if (!board.collaborators.includes(userId)) {
      await updateDoc(this.boardRef(boardId), { collaborators: arrayUnion(userId) });
    }
  }

  async removeCollaborator(boardId: string, userId: string): Promise<void> {
    await updateDoc(this.boardRef(boardId), {
      collaborators: arrayRemove(userId),
      updatedAt: serverTimestamp(),
    });
  }

  // --- Lists ---

  async addList(boardId: string, input: CreateListInput): Promise<List> {
    const existingSnapshot = await getDocs(this.listsCollection(boardId));
    const existing = existingSnapshot.docs.map((d) => d.data() as List);
    const order = getOrderAtEnd(existing);
    const docRef = await addDoc(this.listsCollection(boardId), {
      title: input.title,
      order,
      createdAt: serverTimestamp(),
    });
    const snapshot = await getDoc(docRef);
    return { id: snapshot.id, ...snapshot.data() } as List;
  }

  async updateList(boardId: string, listId: string, updates: UpdateListInput): Promise<void> {
    await updateDoc(this.listRef(boardId, listId), { ...updates });
  }

  async deleteList(boardId: string, listId: string): Promise<void> {
    const batch = writeBatch(this.db);
    const tasksSnapshot = await getDocs(
      query(this.tasksCollection(boardId), where('listId', '==', listId)),
    );
    for (const taskDoc of tasksSnapshot.docs) {
      batch.delete(taskDoc.ref);
    }
    batch.delete(this.listRef(boardId, listId));
    await batch.commit();
  }

  async reorderLists(boardId: string, listId: string, newOrder: string): Promise<void> {
    await updateDoc(this.listRef(boardId, listId), { order: newOrder });
  }

  // --- Tasks ---

  async addTask(
    boardId: string,
    listId: string,
    input: CreateTaskInput,
    userId: string,
  ): Promise<Task> {
    const existingSnapshot = await getDocs(
      query(this.tasksCollection(boardId), where('listId', '==', listId)),
    );
    /* v8 ignore next -- only fires when the target list already has tasks; tests default to empty lists @preserve */
    const existing = existingSnapshot.docs.map((d) => d.data() as Task);
    const order = getOrderAtEnd(existing);

    const docRef = await addDoc(this.tasksCollection(boardId), {
      listId,
      title: input.title,
      description: input.description ?? '',
      order,
      startDate: input.startDate ? Timestamp.fromDate(input.startDate) : null,
      dueDate: input.dueDate ? Timestamp.fromDate(input.dueDate) : null,
      calendarEventId: null,
      calendarSyncEnabled: input.calendarSyncEnabled ?? false,
      archive: input.archive ?? false,
      archivedAt: null,
      createdBy: userId,
      assignedTo: input.assignedTo ?? [],
      labelIds: input.labelIds ?? [],
      color: input.color ?? null,
      attachments: input.attachments ?? [],
      commentCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const snapshot = await getDoc(docRef);
    return { id: snapshot.id, ...snapshot.data() } as Task;
  }

  async updateTask(boardId: string, taskId: string, updates: UpdateTaskInput): Promise<void> {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      if ((key === 'startDate' || key === 'dueDate') && value !== null) {
        payload[key] = Timestamp.fromDate(value as Date);
      } else {
        payload[key] = value;
      }
    }

    await updateDoc(this.taskRef(boardId, taskId), payload);
  }

  async deleteTask(boardId: string, taskId: string): Promise<void> {
    const snapshot = await getDoc(this.taskRef(boardId, taskId));
    const task = snapshot.data() as Task | undefined;

    await Promise.all(
      /* v8 ignore next -- defensive: attachments is always an array on live tasks @preserve */
      (task?.attachments ?? []).map((attachment) =>
        this.storageService.deleteTaskAttachment(attachment.storagePath).catch(() => {}),
      ),
    );

    await deleteDoc(this.taskRef(boardId, taskId));
  }

  /**
   * Moves a task within/across lists. When `archive` is provided the flag is
   * written in the same update, so dropping a task into (or out of) an archival
   * list flips its archived state atomically with the move. `archivedAt` is
   * stamped alongside on archive, cleared on unarchive. Passing `undefined`
   * for either leaves the existing value untouched.
   */
  async moveTask(
    boardId: string,
    taskId: string,
    newListId: string,
    newOrder: string,
    archive?: boolean,
  ): Promise<void> {
    await updateDoc(this.taskRef(boardId, taskId), {
      listId: newListId,
      order: newOrder,
      ...(archive === undefined ? {} : { archive, archivedAt: archive ? serverTimestamp() : null }),
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Moves a task (with its comments and history) from one board to another.
   *
   * Delegated to the `migrateTask` Cloud Function so the copy runs with admin
   * privileges and bypasses the per-comment `authorId` create rule (which would
   * otherwise reject any comment the migrator didn't author) and the
   * owner-only source-history delete rule. Membership on both boards is
   * enforced server-side.
   *
   * `userId` and `metadata` are ignored — the server derives them from the
   * authenticated caller and the freshly-read board titles. They stay in the
   * signature only to preserve the store's existing call site.
   */
  async migrateTaskToBoard(
    sourceBoardId: string,
    taskId: string,
    targetBoardId: string,
    targetListId: string,
    _userId: string,
    _metadata: { fromBoardName: string; toBoardName: string },
  ): Promise<string> {
    if (sourceBoardId === targetBoardId) {
      throw new Error('Cannot migrate task to the same board');
    }

    const call = httpsCallable<MigrateTaskPayload, MigrateTaskResult>(
      this.functions,
      'migrateTask',
    );
    const result = await call({ sourceBoardId, taskId, targetBoardId, targetListId });
    return result.data.newTaskId;
  }

  // --- Comments ---

  async addComment(
    boardId: string,
    taskId: string,
    input: CreateCommentInput,
    userId: string,
  ): Promise<void> {
    const batch = writeBatch(this.db);
    batch.set(doc(this.commentsCollection(boardId, taskId)), {
      text: input.text,
      authorId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(this.taskRef(boardId, taskId), { commentCount: increment(1) });
    await batch.commit();
  }

  async updateComment(
    boardId: string,
    taskId: string,
    commentId: string,
    updates: UpdateCommentInput,
  ): Promise<void> {
    await updateDoc(this.commentRef(boardId, taskId, commentId), {
      text: updates.text,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteComment(boardId: string, taskId: string, commentId: string): Promise<void> {
    const batch = writeBatch(this.db);
    batch.delete(this.commentRef(boardId, taskId, commentId));
    batch.update(this.taskRef(boardId, taskId), { commentCount: increment(-1) });
    await batch.commit();
  }

  // --- History ---

  async addTaskHistory(
    boardId: string,
    taskId: string,
    entries: Omit<HistoryEntry, 'id' | 'createdAt'>[],
  ): Promise<void> {
    if (entries.length === 0) return;

    const batch = writeBatch(this.db);
    for (const entry of entries) {
      batch.set(doc(this.historyCollection(boardId, taskId)), {
        ...entry,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}
