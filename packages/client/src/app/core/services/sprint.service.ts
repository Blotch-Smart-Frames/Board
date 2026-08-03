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
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { addDays } from 'date-fns';
import { FIRESTORE_DB } from '../firebase/firebase.config';
import { getOrderAtEnd } from '../../shared/utils/ordering';
import type {
  Sprint,
  SprintConfig,
  CreateSprintInput,
  UpdateSprintInput,
} from '../../shared/types/board';

const DEFAULT_SPRINT_DURATION_DAYS = 14;

@Service()
export class SprintService {
  private readonly db = inject(FIRESTORE_DB);

  private sprintsCollection(boardId: string) {
    return collection(this.db, 'boards', boardId, 'sprints');
  }

  private sprintRef(boardId: string, sprintId: string) {
    return doc(this.db, 'boards', boardId, 'sprints', sprintId);
  }

  private boardRef(boardId: string) {
    return doc(this.db, 'boards', boardId);
  }

  async createSprint(boardId: string, input: CreateSprintInput): Promise<Sprint> {
    const existing = await this.getBoardSprints(boardId);
    const order = getOrderAtEnd(existing);
    const docRef = await addDoc(this.sprintsCollection(boardId), {
      name: input.name,
      startDate: Timestamp.fromDate(input.startDate),
      endDate: Timestamp.fromDate(input.endDate),
      order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snapshot = await getDoc(docRef);
    return { id: snapshot.id, ...snapshot.data() } as Sprint;
  }

  async updateSprint(boardId: string, sprintId: string, updates: UpdateSprintInput): Promise<void> {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.name !== undefined) payload['name'] = updates.name;
    if (updates.startDate !== undefined) {
      payload['startDate'] = Timestamp.fromDate(updates.startDate);
    }
    if (updates.endDate !== undefined) {
      payload['endDate'] = Timestamp.fromDate(updates.endDate);
    }
    await updateDoc(this.sprintRef(boardId, sprintId), payload);
  }

  async deleteSprint(boardId: string, sprintId: string): Promise<void> {
    await deleteDoc(this.sprintRef(boardId, sprintId));
  }

  async getBoardSprints(boardId: string): Promise<Sprint[]> {
    const snapshot = await getDocs(query(this.sprintsCollection(boardId), orderBy('order')));
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Sprint);
  }

  async calculateNextSprintDates(
    boardId: string,
  ): Promise<{ startDate: Date; endDate: Date; suggestedName: string }> {
    const [boardSnapshot, sprints] = await Promise.all([
      getDoc(this.boardRef(boardId)),
      this.getBoardSprints(boardId),
    ]);
    const durationDays =
      (boardSnapshot.data()?.['sprintConfig'] as SprintConfig | undefined)?.durationDays ??
      DEFAULT_SPRINT_DURATION_DAYS;

    let startDate: Date;
    if (sprints.length === 0) {
      startDate = new Date();
    } else {
      startDate = addDays(sprints[sprints.length - 1].endDate.toDate(), 1);
    }
    startDate.setHours(0, 0, 0, 0);

    const endDate = addDays(startDate, durationDays - 1);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate, suggestedName: `Sprint ${sprints.length + 1}` };
  }

  async updateSprintConfig(boardId: string, config: SprintConfig): Promise<void> {
    await updateDoc(this.boardRef(boardId), { sprintConfig: config, updatedAt: serverTimestamp() });
  }
}
