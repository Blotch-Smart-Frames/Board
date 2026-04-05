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
  type FieldValue,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  Board,
  List,
  Task,
  CreateBoardInput,
  CreateListInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateCommentInput,
  UpdateCommentInput,
  HistoryEntry,
} from '../types/board';
import { initializeDefaultLabels } from './labelService';
import { deleteTaskAttachment, deleteBoardBackground } from './storageService';
import { getOrderAtEnd } from '../utils/ordering';

// Board operations
export const createBoard = async (
  input: CreateBoardInput,
  userId: string,
): Promise<Board> => {
  const boardRef = await addDoc(collection(db, 'boards'), {
    title: input.title,
    ownerId: userId,
    collaborators: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const boardDoc = await getDoc(boardRef);
  const board = { id: boardDoc.id, ...boardDoc.data() } as Board;

  // Initialize default labels for the new board
  await initializeDefaultLabels(board.id);

  return board;
};

export const getBoard = async (boardId: string): Promise<Board | null> => {
  const boardDoc = await getDoc(doc(db, 'boards', boardId));
  if (!boardDoc.exists()) return null;
  return { id: boardDoc.id, ...boardDoc.data() } as Board;
};

export const updateBoard = async (
  boardId: string,
  updates: Partial<Pick<Board, 'title'>> & {
    backgroundImageUrl?: string | FieldValue;
  },
): Promise<void> => {
  await updateDoc(doc(db, 'boards', boardId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

const BATCH_LIMIT = 500;

const commitInChunks = async (
  refs: ReturnType<typeof doc>[],
): Promise<void> => {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const chunk = refs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
};

export const deleteBoard = async (boardId: string): Promise<void> => {
  // Fetch all top-level collections in parallel
  const [listsSnap, tasksSnap, labelsSnap, sprintsSnap] = await Promise.all([
    getDocs(collection(db, 'boards', boardId, 'lists')),
    getDocs(collection(db, 'boards', boardId, 'tasks')),
    getDocs(collection(db, 'boards', boardId, 'labels')),
    getDocs(collection(db, 'boards', boardId, 'sprints')),
  ]);

  // Collect storage paths from task attachments for cleanup
  const storagePaths: string[] = [];
  tasksSnap.forEach((taskDoc) => {
    const data = taskDoc.data();
    if (data.attachments?.length) {
      data.attachments.forEach((a: { storagePath: string }) => {
        storagePaths.push(a.storagePath);
      });
    }
  });

  // Fetch all task subcollections (comments + history) in parallel
  const subcollectionRefs: ReturnType<typeof doc>[] = [];
  const subcollectionFetches = tasksSnap.docs.flatMap((taskDoc) => [
    getDocs(
      collection(db, 'boards', boardId, 'tasks', taskDoc.id, 'comments'),
    ).then((snap) => snap.forEach((d) => subcollectionRefs.push(d.ref))),
    getDocs(
      collection(db, 'boards', boardId, 'tasks', taskDoc.id, 'history'),
    ).then((snap) => snap.forEach((d) => subcollectionRefs.push(d.ref))),
  ]);
  await Promise.all(subcollectionFetches);

  // Collect all document refs to delete
  const allRefs: ReturnType<typeof doc>[] = [
    ...subcollectionRefs,
    ...listsSnap.docs.map((d) => d.ref),
    ...tasksSnap.docs.map((d) => d.ref),
    ...labelsSnap.docs.map((d) => d.ref),
    ...sprintsSnap.docs.map((d) => d.ref),
    doc(db, 'boards', boardId),
  ];

  // Delete all Firestore docs in batches of 500
  await commitInChunks(allRefs);

  // Best-effort storage cleanup
  try {
    await deleteBoardBackground(boardId);
  } catch {
    // Background image may not exist
  }
  await Promise.all(
    storagePaths.map((path) => deleteTaskAttachment(path).catch(() => {})),
  );
};

export const shareBoard = async (
  boardId: string,
  userId: string,
): Promise<void> => {
  const boardRef = doc(db, 'boards', boardId);
  const boardSnap = await getDoc(boardRef);

  if (!boardSnap.exists()) throw new Error('Board not found');

  const board = boardSnap.data() as Board;
  if (!board.collaborators.includes(userId)) {
    await updateDoc(boardRef, {
      collaborators: [...board.collaborators, userId],
      updatedAt: serverTimestamp(),
    });
  }
};

// List operations
export const addList = async (
  boardId: string,
  input: CreateListInput,
): Promise<List> => {
  const listsSnap = await getDocs(collection(db, 'boards', boardId, 'lists'));
  const existingLists = listsSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as List,
  );
  const order = getOrderAtEnd(existingLists);

  const listRef = await addDoc(collection(db, 'boards', boardId, 'lists'), {
    title: input.title,
    order,
    createdAt: serverTimestamp(),
  });

  const listDoc = await getDoc(listRef);
  return { id: listDoc.id, ...listDoc.data() } as List;
};

export const updateList = async (
  boardId: string,
  listId: string,
  updates: { title?: string },
): Promise<void> => {
  await updateDoc(doc(db, 'boards', boardId, 'lists', listId), { ...updates });
};

export const deleteList = async (
  boardId: string,
  listId: string,
): Promise<void> => {
  const batch = writeBatch(db);

  // Delete all tasks in the list
  const tasksSnap = await getDocs(
    query(
      collection(db, 'boards', boardId, 'tasks'),
      where('listId', '==', listId),
    ),
  );
  tasksSnap.forEach((doc) => batch.delete(doc.ref));

  // Delete the list
  batch.delete(doc(db, 'boards', boardId, 'lists', listId));

  await batch.commit();
};

export const reorderLists = async (
  boardId: string,
  listId: string,
  newOrder: string,
): Promise<void> => {
  await updateDoc(doc(db, 'boards', boardId, 'lists', listId), {
    order: newOrder,
  });
};

// Task operations
export const addTask = async (
  boardId: string,
  listId: string,
  input: CreateTaskInput,
  userId: string,
): Promise<Task> => {
  const tasksSnap = await getDocs(
    query(
      collection(db, 'boards', boardId, 'tasks'),
      where('listId', '==', listId),
    ),
  );
  const existingTasks = tasksSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Task,
  );
  const order = getOrderAtEnd(existingTasks);

  const taskData = {
    listId,
    title: input.title,
    description: input.description || '',
    order,
    startDate: input.startDate ? Timestamp.fromDate(input.startDate) : null,
    dueDate: input.dueDate ? Timestamp.fromDate(input.dueDate) : null,
    calendarEventId: null,
    calendarSyncEnabled: input.calendarSyncEnabled || false,
    createdBy: userId,
    assignedTo: input.assignedTo || [],
    labelIds: input.labelIds || [],
    attachments: input.attachments || [],
    sprintId: input.sprintId || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const taskRef = await addDoc(
    collection(db, 'boards', boardId, 'tasks'),
    taskData,
  );
  const taskDoc = await getDoc(taskRef);
  return { ...taskDoc.data(), id: taskDoc.id } as Task;
};

export const updateTask = async (
  boardId: string,
  taskId: string,
  updates: UpdateTaskInput & { calendarEventId?: string },
): Promise<void> => {
  const updateData: Record<string, unknown> = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  if (updates.startDate !== undefined) {
    updateData.startDate = updates.startDate
      ? Timestamp.fromDate(updates.startDate)
      : null;
  }

  if (updates.dueDate !== undefined) {
    updateData.dueDate = updates.dueDate
      ? Timestamp.fromDate(updates.dueDate)
      : null;
  }

  if (updates.completedAt !== undefined) {
    updateData.completedAt = updates.completedAt
      ? Timestamp.fromDate(updates.completedAt)
      : null;
  }

  if (updates.sprintId !== undefined) {
    updateData.sprintId = updates.sprintId;
  }

  // Remove undefined values - Firebase doesn't accept them
  const cleanedData = Object.fromEntries(
    Object.entries(updateData).filter(([, value]) => value !== undefined),
  );

  await updateDoc(doc(db, 'boards', boardId, 'tasks', taskId), cleanedData);
};

export const deleteTask = async (
  boardId: string,
  taskId: string,
): Promise<void> => {
  const taskDoc = await getDoc(doc(db, 'boards', boardId, 'tasks', taskId));
  if (taskDoc.exists()) {
    const task = taskDoc.data();
    if (task.attachments?.length) {
      await Promise.all(
        task.attachments.map((a: { storagePath: string }) =>
          deleteTaskAttachment(a.storagePath).catch(() => {}),
        ),
      );
    }
  }
  await deleteDoc(doc(db, 'boards', boardId, 'tasks', taskId));
};

export const moveTask = async (
  boardId: string,
  taskId: string,
  newListId: string,
  newOrder: string,
): Promise<void> => {
  await updateDoc(doc(db, 'boards', boardId, 'tasks', taskId), {
    listId: newListId,
    order: newOrder,
    updatedAt: serverTimestamp(),
  });
};

// Comment operations
export const addComment = async (
  boardId: string,
  taskId: string,
  input: CreateCommentInput,
  userId: string,
): Promise<void> => {
  const batch = writeBatch(db);
  const commentRef = doc(
    collection(db, 'boards', boardId, 'tasks', taskId, 'comments'),
  );
  batch.set(commentRef, {
    text: input.text,
    authorId: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'boards', boardId, 'tasks', taskId), {
    commentCount: increment(1),
  });
  await batch.commit();
};

export const updateComment = async (
  boardId: string,
  taskId: string,
  commentId: string,
  updates: UpdateCommentInput,
): Promise<void> => {
  await updateDoc(
    doc(db, 'boards', boardId, 'tasks', taskId, 'comments', commentId),
    {
      text: updates.text,
      updatedAt: serverTimestamp(),
    },
  );
};

// History operations
export const addTaskHistory = async (
  boardId: string,
  taskId: string,
  entries: Omit<HistoryEntry, 'id' | 'createdAt'>[],
): Promise<void> => {
  if (entries.length === 0) return;
  const batch = writeBatch(db);
  for (const entry of entries) {
    const historyRef = doc(
      collection(db, 'boards', boardId, 'tasks', taskId, 'history'),
    );
    batch.set(historyRef, {
      ...entry,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
};

export const deleteComment = async (
  boardId: string,
  taskId: string,
  commentId: string,
): Promise<void> => {
  const batch = writeBatch(db);
  batch.delete(
    doc(db, 'boards', boardId, 'tasks', taskId, 'comments', commentId),
  );
  batch.update(doc(db, 'boards', boardId, 'tasks', taskId), {
    commentCount: increment(-1),
  });
  await batch.commit();
};
