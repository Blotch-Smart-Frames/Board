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
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  Sprint,
  CreateSprintInput,
  UpdateSprintInput,
  SprintConfig,
} from '../types/board';
import { getOrderAtEnd } from '../utils/ordering';
import { addDays } from 'date-fns';

export const createSprint = async (
  boardId: string,
  input: CreateSprintInput,
): Promise<Sprint> => {
  const sprintsSnap = await getDocs(
    collection(db, 'boards', boardId, 'sprints'),
  );
  const existingSprints = sprintsSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Sprint,
  );
  const order = getOrderAtEnd(existingSprints);

  const sprintRef = await addDoc(collection(db, 'boards', boardId, 'sprints'), {
    name: input.name,
    startDate: Timestamp.fromDate(input.startDate),
    endDate: Timestamp.fromDate(input.endDate),
    order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const sprintDoc = await getDoc(sprintRef);
  return { id: sprintDoc.id, ...sprintDoc.data() } as Sprint;
};

export const updateSprint = async (
  boardId: string,
  sprintId: string,
  updates: UpdateSprintInput,
): Promise<void> => {
  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.name !== undefined) {
    updateData.name = updates.name;
  }

  if (updates.startDate !== undefined) {
    updateData.startDate = Timestamp.fromDate(updates.startDate);
  }

  if (updates.endDate !== undefined) {
    updateData.endDate = Timestamp.fromDate(updates.endDate);
  }

  await updateDoc(doc(db, 'boards', boardId, 'sprints', sprintId), updateData);
};

export const canDeleteSprint = async (
  boardId: string,
  sprintId: string,
): Promise<{ canDelete: boolean; taskCount: number }> => {
  const tasksSnap = await getDocs(
    query(
      collection(db, 'boards', boardId, 'tasks'),
      where('sprintId', '==', sprintId),
    ),
  );

  const taskCount = tasksSnap.size;
  return {
    canDelete: taskCount === 0,
    taskCount,
  };
};

export const deleteSprint = async (
  boardId: string,
  sprintId: string,
): Promise<void> => {
  const { canDelete, taskCount } = await canDeleteSprint(boardId, sprintId);

  if (!canDelete) {
    throw new Error(
      `Cannot delete sprint: ${taskCount} task${taskCount !== 1 ? 's are' : ' is'} still assigned to this sprint`,
    );
  }

  await deleteDoc(doc(db, 'boards', boardId, 'sprints', sprintId));
};

export const getBoardSprints = async (boardId: string): Promise<Sprint[]> => {
  const sprintsSnap = await getDocs(
    query(collection(db, 'boards', boardId, 'sprints'), orderBy('order')),
  );

  return sprintsSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Sprint,
  );
};

export const calculateNextSprintDates = async (
  boardId: string,
): Promise<{ startDate: Date; endDate: Date; suggestedName: string }> => {
  // Get board config for duration
  const boardDoc = await getDoc(doc(db, 'boards', boardId));
  const boardData = boardDoc.data();
  const sprintConfig = boardData?.sprintConfig as SprintConfig | undefined;
  const durationDays = sprintConfig?.durationDays ?? 14;

  // Get existing sprints to find the last one
  const sprints = await getBoardSprints(boardId);

  let startDate: Date;
  let sprintNumber = 1;

  if (sprints.length === 0) {
    // First sprint: start today
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else {
    // Next sprint: start day after last sprint ends
    const lastSprint = sprints[sprints.length - 1];
    startDate = addDays(lastSprint.endDate.toDate(), 1);
    startDate.setHours(0, 0, 0, 0);
    sprintNumber = sprints.length + 1;
  }

  const endDate = addDays(startDate, durationDays - 1);
  endDate.setHours(23, 59, 59, 999);

  return {
    startDate,
    endDate,
    suggestedName: `Sprint ${sprintNumber}`,
  };
};

export const updateSprintConfig = async (
  boardId: string,
  config: SprintConfig,
): Promise<void> => {
  await updateDoc(doc(db, 'boards', boardId), {
    sprintConfig: config,
    updatedAt: serverTimestamp(),
  });
};
