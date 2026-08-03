import { collection, orderBy, query, type Firestore, type Query } from 'firebase/firestore';
import type { Comment, HistoryEntry } from '../../shared/types/board';

// Centralized subcollection queries for a task's comments and history, mirroring
// the source app's queries/firestoreRefs.ts. Used by the task-detail sections'
// collectionSignal subscriptions.

export const taskCommentsQuery = (db: Firestore, boardId: string, taskId: string): Query =>
  query(
    collection(db, 'boards', boardId, 'tasks', taskId, 'comments'),
    orderBy('createdAt'),
  ) as Query<Comment>;

export const taskHistoryQuery = (db: Firestore, boardId: string, taskId: string): Query =>
  query(
    collection(db, 'boards', boardId, 'tasks', taskId, 'history'),
    orderBy('createdAt', 'desc'),
  ) as Query<HistoryEntry>;
