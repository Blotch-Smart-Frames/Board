import {
  doc,
  collection,
  query,
  where,
  orderBy,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Board, List, Task, Label } from '../types/board';

// Board document reference
export const getBoardRef = (boardId: string): DocumentReference<Board> =>
  doc(db, 'boards', boardId) as DocumentReference<Board>;

// Board lists collection query
export const getBoardListsQuery = (boardId: string): Query<List> =>
  query(
    collection(db, 'boards', boardId, 'lists'),
    orderBy('order')
  ) as Query<List>;

// Board tasks collection query
export const getBoardTasksQuery = (boardId: string): Query<Task> =>
  collection(db, 'boards', boardId, 'tasks') as Query<Task>;

// User's owned boards query
export const getUserBoardsQuery = (userId: string): Query<Board> =>
  query(
    collection(db, 'boards'),
    where('ownerId', '==', userId),
    orderBy('createdAt', 'desc')
  ) as Query<Board>;

// Board labels collection query
export const getBoardLabelsQuery = (boardId: string): Query<Label> =>
  query(
    collection(db, 'boards', boardId, 'labels'),
    orderBy('order')
  ) as Query<Label>;

// Label document reference
export const getLabelRef = (
  boardId: string,
  labelId: string
): DocumentReference<Label> =>
  doc(db, 'boards', boardId, 'labels', labelId) as DocumentReference<Label>;
