import type { Timestamp } from 'firebase/firestore';

// Sprint types
export type Sprint = {
  id: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  order: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type SprintConfig = {
  durationDays: number; // e.g., 14 for two-week sprints
};

export type CreateSprintInput = {
  name: string;
  startDate: Date;
  endDate: Date;
};

export type UpdateSprintInput = {
  name?: string;
  startDate?: Date;
  endDate?: Date;
};

export type Label = {
  id: string;
  name: string;
  color: string; // hex color
  emoji?: string;
  order: string;
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

export type Attachment = {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  downloadUrl: string;
  uploadedAt: number;
};

export type Board = {
  id: string;
  title: string;
  ownerId: string;
  collaborators: string[];
  backgroundImageUrl?: string;
  sprintConfig?: SprintConfig;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type List = {
  id: string;
  title: string;
  order: string;
  createdAt: Timestamp;
};

export type Task = {
  id: string;
  listId: string;
  title: string;
  description?: string;
  order: string;
  startDate?: Timestamp;
  dueDate?: Timestamp;
  calendarEventId?: string;
  calendarSyncEnabled: boolean;
  createdBy: string;
  assignedTo?: string[];
  labelIds?: string[];
  color?: string;
  sprintId?: string;
  attachments?: Attachment[];
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

export type CreateTaskInput = {
  title: string;
  description?: string;
  startDate?: Date;
  dueDate?: Date;
  calendarSyncEnabled?: boolean;
  assignedTo?: string[];
  labelIds?: string[];
  color?: string;
  sprintId?: string;
  attachments?: Attachment[];
};

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  startDate?: Date | null;
  dueDate?: Date | null;
  calendarSyncEnabled?: boolean;
  assignedTo?: string[];
  labelIds?: string[];
  color?: string | null;
  sprintId?: string | null;
  completedAt?: Date | null;
  attachments?: Attachment[];
};

export type CreateListInput = {
  title: string;
};

export type UpdateListInput = {
  title?: string;
};

export type Comment = {
  id: string;
  text: string;
  authorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type CreateCommentInput = {
  text: string;
};

export type UpdateCommentInput = {
  text: string;
};

export type CreateBoardInput = {
  title: string;
};
