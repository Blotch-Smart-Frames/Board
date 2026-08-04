import { Service, inject } from '@angular/core';
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
import { FIRESTORE_DB } from '../firebase/firebase.config';
import { defaultLabels } from '../config/default-labels';
import { getOrderAtEnd, getOrderBetween } from '../../shared/utils/ordering';
import type { Label, CreateLabelInput, UpdateLabelInput } from '../../shared/types/board';

@Service()
export class LabelService {
  private readonly db = inject(FIRESTORE_DB);

  private labelsCollection(boardId: string) {
    return collection(this.db, 'boards', boardId, 'labels');
  }

  private labelRef(boardId: string, labelId: string) {
    return doc(this.db, 'boards', boardId, 'labels', labelId);
  }

  private tasksCollection(boardId: string) {
    return collection(this.db, 'boards', boardId, 'tasks');
  }

  async createLabel(boardId: string, input: CreateLabelInput): Promise<Label> {
    const existing = await this.getBoardLabels(boardId);
    const order = getOrderAtEnd(existing);
    const docRef = await addDoc(this.labelsCollection(boardId), {
      name: input.name,
      color: input.color,
      emoji: input.emoji || null,
      order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snapshot = await getDoc(docRef);
    return { id: snapshot.id, ...snapshot.data() } as Label;
  }

  async updateLabel(boardId: string, labelId: string, updates: UpdateLabelInput): Promise<void> {
    await updateDoc(this.labelRef(boardId, labelId), { ...updates, updatedAt: serverTimestamp() });
  }

  async deleteLabel(boardId: string, labelId: string): Promise<void> {
    const batch = writeBatch(this.db);
    const tasksSnapshot = await getDocs(
      query(this.tasksCollection(boardId), where('labelIds', 'array-contains', labelId)),
    );
    for (const taskDoc of tasksSnapshot.docs) {
      const labelIds = ((taskDoc.data()['labelIds'] as string[] | undefined) ?? []).filter(
        (id) => id !== labelId,
      );
      batch.update(taskDoc.ref, { labelIds, updatedAt: serverTimestamp() });
    }
    batch.delete(this.labelRef(boardId, labelId));
    await batch.commit();
  }

  async getBoardLabels(boardId: string): Promise<Label[]> {
    const snapshot = await getDocs(query(this.labelsCollection(boardId), orderBy('order')));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Label);
  }

  async initializeDefaultLabels(boardId: string): Promise<Label[]> {
    const existing = await this.getBoardLabels(boardId);
    if (existing.length > 0) return existing;

    const batch = writeBatch(this.db);
    let previousOrder: string | null = null;
    for (const label of defaultLabels) {
      const order = getOrderBetween(previousOrder, null);
      previousOrder = order;
      const docRef = doc(this.labelsCollection(boardId));
      batch.set(docRef, {
        name: label.name,
        color: label.color,
        emoji: label.emoji,
        order,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return this.getBoardLabels(boardId);
  }
}
