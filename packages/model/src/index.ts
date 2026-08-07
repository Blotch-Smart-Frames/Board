/**
 * Shared domain models for the board app, consumed by both the Angular client
 * (`firebase/firestore`) and the Firebase Functions (`firebase-admin/firestore`).
 *
 * The two Firestore SDKs ship different `Timestamp` classes, so instead of
 * importing either one we describe the members we actually use via a structural
 * interface. Both SDK `Timestamp` classes structurally satisfy it (they carry
 * these members and more), so a value from either assigns into these fields and
 * `.toDate()` reads compile in both packages.
 */
export interface FirestoreTimestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

export type Sprint = {
  id: string;
  name: string;
  startDate: FirestoreTimestamp;
  endDate: FirestoreTimestamp;
  order: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};

export type SprintConfig = {
  durationDays: number;
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
  color: string;
  emoji?: string;
  order: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
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
  /**
   * IDs of lists that act as archives: dragging a task into one of these marks
   * the task `archive: true`, and dragging it back out clears the flag. Stored
   * as IDs (not titles) so renaming a list keeps the configuration intact.
   */
  archivalListIds?: string[];
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};

export type List = {
  id: string;
  title: string;
  order: string;
  createdAt: FirestoreTimestamp;
};

/**
 * How far a past-due ticket has been escalated. Bumped one step per escalation
 * run by the `escalatePastDue` scheduled function, capped at `level-3`.
 */
export type EscalationLevel = 'none' | 'level-1' | 'level-2' | 'level-3';

/**
 * A WhatsApp contact to notify when a ticket reaches a given escalation level.
 * Configured per user on their profile (see {@link User.escalationContacts}).
 */
export type EscalationContact = {
  name: string;
  /** Phone number in E.164 form, e.g. `+14155238886`. */
  number: string;
  /** The escalation level whose notification goes to this contact. */
  escalation: EscalationLevel;
};

export type Task = {
  id: string;
  listId: string;
  title: string;
  description?: string;
  order: string;
  startDate?: FirestoreTimestamp;
  dueDate?: FirestoreTimestamp;
  calendarEventId?: string;
  calendarSyncEnabled: boolean;
  /**
   * Whether the task has been archived. Set to `true` when a task is dragged
   * into one of the board's archival lists (see {@link Board.archivalListIds});
   * absent or `false` means active. The board view filters archived tasks out at
   * the Firestore query level to keep document reads bounded on large boards.
   * (Every task written by the app carries this field — see BoardService.addTask
   * and the one-off backfill — so `where('archive','==',false)` matches them.)
   */
  archive?: boolean;
  createdBy: string;
  assignedTo?: string[];
  labelIds?: string[];
  color?: string;
  attachments?: Attachment[];
  commentCount?: number;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  completedAt?: FirestoreTimestamp;
  /** Current escalation level for a past-due ticket. Absent means `none`. */
  escalation?: EscalationLevel;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  calendarSyncToken?: string;
  /** WhatsApp contacts to notify as this user's assigned tickets escalate. */
  escalationContacts?: EscalationContact[];
};

/**
 * Resolved collaborator view for a board: merges the users collection with
 * owner/self fallbacks so an unsynced owner or unknown user still renders.
 */
export type Collaborator = {
  id: string;
  email: string;
  name: string;
  photoURL?: string | null;
  isOwner: boolean;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  startDate?: Date;
  dueDate?: Date;
  calendarSyncEnabled?: boolean;
  archive?: boolean;
  assignedTo?: string[];
  labelIds?: string[];
  color?: string;
  attachments?: Attachment[];
};

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  startDate?: Date | null;
  dueDate?: Date | null;
  calendarEventId?: string | null;
  calendarSyncEnabled?: boolean;
  archive?: boolean;
  assignedTo?: string[];
  labelIds?: string[];
  color?: string | null;
  completedAt?: Date | null;
  attachments?: Attachment[];
  escalation?: EscalationLevel;
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
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};

export type CreateCommentInput = {
  text: string;
};

export type UpdateCommentInput = {
  text: string;
};

export type HistoryAction =
  | 'label_added'
  | 'label_removed'
  | 'assignee_added'
  | 'assignee_removed'
  | 'attachment_added'
  | 'attachment_removed'
  | 'moved'
  | 'board_migrated'
  | 'completed'
  | 'reopened'
  | 'field_changed';

export type HistoryEntry = {
  id: string;
  action: HistoryAction;
  field?: string;
  userId: string;
  metadata?: {
    labelName?: string;
    labelColor?: string;
    userName?: string;
    fromListName?: string;
    toListName?: string;
    fromBoardName?: string;
    toBoardName?: string;
    fileName?: string;
    oldValue?: string;
    newValue?: string;
  };
  createdAt: FirestoreTimestamp;
};

export type CreateBoardInput = {
  title: string;
};
