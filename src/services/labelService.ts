import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Label, CreateLabelInput, UpdateLabelInput } from '../types/board';
import { defaultLabels } from '../config/defaultLabels';
import { getOrderAtEnd, getOrderBetween } from '../utils/ordering';

export const createLabel = async (
  boardId: string,
  input: CreateLabelInput,
): Promise<Label> => {
  const labelsSnap = await getDocs(collection(db, 'boards', boardId, 'labels'));
  const existingLabels = labelsSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Label,
  );
  const order = getOrderAtEnd(existingLabels);

  const labelRef = await addDoc(collection(db, 'boards', boardId, 'labels'), {
    name: input.name,
    color: input.color,
    emoji: input.emoji || null,
    order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const labelDoc = await getDoc(labelRef);
  return { id: labelDoc.id, ...labelDoc.data() } as Label;
};

export const updateLabel = async (
  boardId: string,
  labelId: string,
  updates: UpdateLabelInput,
): Promise<void> => {
  await updateDoc(doc(db, 'boards', boardId, 'labels', labelId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteLabel = async (
  boardId: string,
  labelId: string,
): Promise<void> => {
  const batch = writeBatch(db);

  // Find all tasks that use this label
  const tasksSnap = await getDocs(
    query(
      collection(db, 'boards', boardId, 'tasks'),
      where('labelIds', 'array-contains', labelId),
    ),
  );

  // Remove the label from each task
  tasksSnap.forEach((taskDoc) => {
    const taskData = taskDoc.data();
    const updatedLabelIds = (taskData.labelIds as string[]).filter(
      (id) => id !== labelId,
    );
    batch.update(taskDoc.ref, {
      labelIds: updatedLabelIds,
      updatedAt: serverTimestamp(),
    });
  });

  // Delete the label
  batch.delete(doc(db, 'boards', boardId, 'labels', labelId));

  await batch.commit();
};

export const getBoardLabels = async (boardId: string): Promise<Label[]> => {
  const labelsSnap = await getDocs(
    query(collection(db, 'boards', boardId, 'labels'), orderBy('order')),
  );

  return labelsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Label);
};

export const initializeDefaultLabels = async (
  boardId: string,
): Promise<Label[]> => {
  // Check if labels already exist
  const existingLabels = await getBoardLabels(boardId);
  if (existingLabels.length > 0) {
    return existingLabels;
  }

  // Create default labels with fractional ordering
  const batch = writeBatch(db);
  const labelsRef = collection(db, 'boards', boardId, 'labels');

  let prevOrder: string | null = null;
  defaultLabels.forEach((label) => {
    const labelDocRef = doc(labelsRef);
    const order = getOrderBetween(prevOrder, null);
    batch.set(labelDocRef, {
      name: label.name,
      color: label.color,
      emoji: label.emoji,
      order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    prevOrder = order;
  });

  await batch.commit();

  // Return the created labels
  return getBoardLabels(boardId);
};
