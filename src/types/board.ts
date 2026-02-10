import type { Timestamp } from "firebase/firestore";

export type Label = {
  id: string;
  name: string;
  color: string; // hex color
  emoji?: string;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type CreateLabelInput = {
  name: string;
  color: string;
  emoji?: string;
};

export type UpdateLabelInput = {
  name?: string;
  color?: string;
  emoji?: string;
};

export type Board = {
  id: string;
  title: string;
  ownerId: string;
  collaborators: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type List = {
  id: string;
  title: string;
  order: number;
  createdAt: Timestamp;
};

export type Task = {
  id: string;
  listId: string;
  title: string;
  description?: string;
  order: number;
  dueDate?: Timestamp;
  calendarEventId?: string;
  calendarSyncEnabled: boolean;
  createdBy: string;
  assignedTo?: string[];
  labelIds?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  calendarSyncToken?: string;
};

export type BoardWithData = Board & {
  lists: List[];
  tasks: Task[];
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  dueDate?: Date;
  calendarSyncEnabled?: boolean;
  assignedTo?: string[];
  labelIds?: string[];
};

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  dueDate?: Date | null;
  calendarSyncEnabled?: boolean;
  assignedTo?: string[];
  labelIds?: string[];
  completedAt?: Date | null;
};

export type CreateListInput = {
  title: string;
};

export type UpdateListInput = {
  title?: string;
};

export type CreateBoardInput = {
  title: string;
};
