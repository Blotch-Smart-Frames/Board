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
  type DocumentReference,
  type FieldValue,
} from 'firebase/firestore';
import { FIRESTORE_DB } from '../firebase/firebase.config';
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

const BATCH_LIMIT = 500;

@Service()
export class BoardService {
  private readonly db = inject(FIRESTORE_DB);
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

  private labelsCollection(boardId: string) {
    return collection(this.db, 'boards', boardId, 'labels');
  }

  private sprintsCollection(boardId: string) {
    return collection(this.db, 'boards', boardId, 'sprints');
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
    updates: Partial<Pick<Board, 'title'>> & { backgroundImageUrl?: string | FieldValue },
  ): Promise<void> {
    await updateDoc(this.boardRef(boardId), { ...updates, updatedAt: serverTimestamp() });
  }

  async deleteBoard(boardId: string): Promise<void> {
    const board = await this.getBoard(boardId);

    const [listsSnapshot, tasksSnapshot, labelsSnapshot, sprintsSnapshot] = await Promise.all([
      getDocs(this.listsCollection(boardId)),
      getDocs(this.tasksCollection(boardId)),
      getDocs(this.labelsCollection(boardId)),
      getDocs(this.sprintsCollection(boardId)),
    ]);

    const attachmentPaths: string[] = [];
    const subcollectionRefs: DocumentReference[] = [];

    await Promise.all(
      tasksSnapshot.docs.flatMap((taskDoc) => {
        const task = taskDoc.data() as Task;
        for (const attachment of task.attachments ?? []) {
          attachmentPaths.push(attachment.storagePath);
        }
        return [
          getDocs(this.commentsCollection(boardId, taskDoc.id)).then((snap) => {
            snap.docs.forEach((d) => subcollectionRefs.push(d.ref));
          }),
          getDocs(this.historyCollection(boardId, taskDoc.id)).then((snap) => {
            snap.docs.forEach((d) => subcollectionRefs.push(d.ref));
          }),
        ];
      }),
    );

    const allRefs: DocumentReference[] = [
      ...subcollectionRefs,
      ...listsSnapshot.docs.map((d) => d.ref),
      ...tasksSnapshot.docs.map((d) => d.ref),
      ...labelsSnapshot.docs.map((d) => d.ref),
      ...sprintsSnapshot.docs.map((d) => d.ref),
      this.boardRef(boardId),
    ];

    await this.commitInChunks(allRefs);

    await Promise.all([
      board?.backgroundImageUrl
        ? this.storageService.deleteBoardBackground(boardId).catch(() => {})
        : Promise.resolve(),
      ...attachmentPaths.map((path) =>
        this.storageService.deleteTaskAttachment(path).catch(() => {}),
      ),
    ]);
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
      createdBy: userId,
      assignedTo: input.assignedTo ?? [],
      labelIds: input.labelIds ?? [],
      color: input.color ?? null,
      sprintId: input.sprintId ?? null,
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
      if ((key === 'startDate' || key === 'dueDate' || key === 'completedAt') && value !== null) {
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
      (task?.attachments ?? []).map((attachment) =>
        this.storageService.deleteTaskAttachment(attachment.storagePath).catch(() => {}),
      ),
    );

    await deleteDoc(this.taskRef(boardId, taskId));
  }

  async moveTask(
    boardId: string,
    taskId: string,
    newListId: string,
    newOrder: string,
  ): Promise<void> {
    await updateDoc(this.taskRef(boardId, taskId), {
      listId: newListId,
      order: newOrder,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Moves a task (with its comments and history) from one board to another.
   * The source and target boards may have different labels/sprints, so those
   * per-board references are dropped rather than carried over. Attachments keep
   * their storage path (which encodes the source boardId) — the user is
   * assumed to remain a member of the source board's storage bucket.
   *
   * A `board_migrated` history entry is appended so the target task's timeline
   * records where it came from.
   */
  async migrateTaskToBoard(
    sourceBoardId: string,
    taskId: string,
    targetBoardId: string,
    targetListId: string,
    userId: string,
    metadata: { fromBoardName: string; toBoardName: string },
  ): Promise<string> {
    if (sourceBoardId === targetBoardId) {
      throw new Error('Cannot migrate task to the same board');
    }

    const [taskSnap, commentsSnap, historySnap, targetTasksSnap] = await Promise.all([
      getDoc(this.taskRef(sourceBoardId, taskId)),
      getDocs(this.commentsCollection(sourceBoardId, taskId)),
      getDocs(this.historyCollection(sourceBoardId, taskId)),
      getDocs(query(this.tasksCollection(targetBoardId), where('listId', '==', targetListId))),
    ]);

    if (!taskSnap.exists()) {
      throw new Error('Task not found');
    }

    const source = taskSnap.data() as Task;
    const newOrder = getOrderAtEnd(targetTasksSnap.docs.map((d) => d.data() as Task));
    const newTaskRef = doc(this.tasksCollection(targetBoardId));

    // Split into two batches: writes (new task + copied subcollections + migration history) then deletes.
    // Comments and history document limits stay under 500 in practice; if a task
    // has thousands of entries this would need chunking, but that's not the
    // shape we see today.
    const writeBatchRef = writeBatch(this.db);
    writeBatchRef.set(newTaskRef, {
      listId: targetListId,
      title: source.title,
      description: source.description ?? '',
      order: newOrder,
      startDate: source.startDate ?? null,
      dueDate: source.dueDate ?? null,
      calendarEventId: source.calendarEventId ?? null,
      calendarSyncEnabled: source.calendarSyncEnabled ?? false,
      createdBy: source.createdBy,
      assignedTo: source.assignedTo ?? [],
      // Labels and sprints belong to the source board's collections — dropped.
      labelIds: [],
      sprintId: null,
      color: source.color ?? null,
      attachments: source.attachments ?? [],
      commentCount: source.commentCount ?? 0,
      completedAt: source.completedAt ?? null,
      createdAt: source.createdAt,
      updatedAt: serverTimestamp(),
    });

    for (const commentDoc of commentsSnap.docs) {
      writeBatchRef.set(
        doc(this.commentsCollection(targetBoardId, newTaskRef.id), commentDoc.id),
        commentDoc.data(),
      );
    }

    for (const historyDoc of historySnap.docs) {
      writeBatchRef.set(
        doc(this.historyCollection(targetBoardId, newTaskRef.id), historyDoc.id),
        historyDoc.data(),
      );
    }

    writeBatchRef.set(doc(this.historyCollection(targetBoardId, newTaskRef.id)), {
      action: 'board_migrated',
      userId,
      metadata,
      createdAt: serverTimestamp(),
    });

    await writeBatchRef.commit();

    const deleteRefs: DocumentReference[] = [
      ...commentsSnap.docs.map((d) => d.ref),
      ...historySnap.docs.map((d) => d.ref),
      this.taskRef(sourceBoardId, taskId),
    ];
    await this.commitInChunks(deleteRefs);

    return newTaskRef.id;
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

  // --- Internal helpers ---

  private async commitInChunks(refs: DocumentReference[]): Promise<void> {
    for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      for (const ref of refs.slice(i, i + BATCH_LIMIT)) {
        batch.delete(ref);
      }
      await batch.commit();
    }
  }
}
