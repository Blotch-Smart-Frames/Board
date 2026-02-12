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
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
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
} from '../types/board';
import { initializeDefaultLabels } from './labelService';
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

export const getUserBoards = async (userId: string): Promise<Board[]> => {
  const ownedQuery = query(
    collection(db, 'boards'),
    where('ownerId', '==', userId),
    orderBy('createdAt', 'desc'),
  );

  const collaboratorQuery = query(
    collection(db, 'boards'),
    where('collaborators', 'array-contains', userId),
    orderBy('createdAt', 'desc'),
  );

  const [ownedSnap, collaboratorSnap] = await Promise.all([
    getDocs(ownedQuery),
    getDocs(collaboratorQuery),
  ]);

  const boards: Board[] = [];
  ownedSnap.forEach((doc) =>
    boards.push({ id: doc.id, ...doc.data() } as Board),
  );
  collaboratorSnap.forEach((doc) =>
    boards.push({ id: doc.id, ...doc.data() } as Board),
  );

  return boards;
};

export const updateBoard = async (
  boardId: string,
  updates: Partial<Pick<Board, 'title' | 'backgroundImageUrl'>>,
): Promise<void> => {
  await updateDoc(doc(db, 'boards', boardId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteBoard = async (boardId: string): Promise<void> => {
  const batch = writeBatch(db);

  // Delete all lists
  const listsSnap = await getDocs(collection(db, 'boards', boardId, 'lists'));
  listsSnap.forEach((doc) => batch.delete(doc.ref));

  // Delete all tasks
  const tasksSnap = await getDocs(collection(db, 'boards', boardId, 'tasks'));
  tasksSnap.forEach((doc) => batch.delete(doc.ref));

  // Delete all labels
  const labelsSnap = await getDocs(collection(db, 'boards', boardId, 'labels'));
  labelsSnap.forEach((doc) => batch.delete(doc.ref));

  // Delete the board
  batch.delete(doc(db, 'boards', boardId));

  await batch.commit();
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

// Real-time subscriptions
export const subscribeToBoard = (
  boardId: string,
  callbacks: {
    onBoard: (board: Board) => void;
    onLists: (lists: List[]) => void;
    onTasks: (tasks: Task[]) => void;
    onError: (error: Error) => void;
  },
): Unsubscribe => {
  const unsubscribes: Unsubscribe[] = [];

  // Subscribe to board
  unsubscribes.push(
    onSnapshot(
      doc(db, 'boards', boardId),
      (doc) => {
        if (doc.exists()) {
          callbacks.onBoard({ id: doc.id, ...doc.data() } as Board);
        }
      },
      callbacks.onError,
    ),
  );

  // Subscribe to lists
  unsubscribes.push(
    onSnapshot(
      query(collection(db, 'boards', boardId, 'lists'), orderBy('order')),
      (snapshot) => {
        const lists = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as List,
        );
        callbacks.onLists(lists);
      },
      callbacks.onError,
    ),
  );

  // Subscribe to tasks
  unsubscribes.push(
    onSnapshot(
      collection(db, 'boards', boardId, 'tasks'),
      (snapshot) => {
        const tasks = snapshot.docs.map(
          (doc) => ({ ...doc.data(), id: doc.id }) as Task,
        );
        callbacks.onTasks(tasks);
      },
      callbacks.onError,
    ),
  );

  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
};

export const subscribeToUserBoards = (
  userId: string,
  callback: (boards: Board[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => {
  return onSnapshot(
    query(
      collection(db, 'boards'),
      where('ownerId', '==', userId),
      orderBy('createdAt', 'desc'),
    ),
    (snapshot) => {
      const boards = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Board,
      );
      callback(boards);
    },
    onError,
  );
};
