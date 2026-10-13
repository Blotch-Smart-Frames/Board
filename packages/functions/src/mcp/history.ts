import { FieldValue, type Firestore, type WriteBatch } from "firebase-admin/firestore";
import type { HistoryEntry, Label, Task } from "@blotch/model";
import { taskDoc, type Member } from "./board-data";

/**
 * Builds task history entries in the same shapes the web client writes (see
 * packages/client/src/app/shared/utils/task-history-diff.ts), so changes made
 * through MCP show up in the task's History tab like any other edit.
 */
export type HistoryInput = Omit<HistoryEntry, "id" | "createdAt">;

export type FieldChanges = {
  title?: string;
  description?: string;
  startDate?: Date | null;
  dueDate?: Date | null;
  color?: string | null;
};

function formatDate(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString("en-US", { timeZone: "UTC" }) : "";
}

export function fieldChangeEntries(
  task: Task,
  changes: FieldChanges,
  userId: string,
): HistoryInput[] {
  const entries: HistoryInput[] = [];
  const push = (field: string, oldValue: string, newValue: string) => {
    if (oldValue !== newValue) {
      entries.push({
        action: "field_changed",
        field,
        userId,
        metadata: { oldValue, newValue },
      });
    }
  };
  if (changes.title !== undefined) push("title", task.title, changes.title);
  if (changes.description !== undefined) {
    push("description", task.description ?? "", changes.description);
  }
  for (const field of ["startDate", "dueDate"] as const) {
    if (changes[field] === undefined) continue;
    const before = task[field]?.toDate();
    const after = changes[field];
    if (before?.getTime() !== after?.getTime()) {
      entries.push({
        action: "field_changed",
        field,
        userId,
        metadata: { oldValue: formatDate(before), newValue: formatDate(after) },
      });
    }
  }
  if (changes.color !== undefined) {
    push("color", task.color ?? "", changes.color ?? "");
  }
  return entries;
}

export function assigneeEntries(
  added: Member[],
  removed: Member[],
  userId: string,
): HistoryInput[] {
  return [
    ...added.map((member): HistoryInput => ({
      action: "assignee_added",
      userId,
      metadata: { userName: member.name },
    })),
    ...removed.map((member): HistoryInput => ({
      action: "assignee_removed",
      userId,
      metadata: { userName: member.name },
    })),
  ];
}

export function labelEntries(
  added: Label[],
  removed: Label[],
  userId: string,
): HistoryInput[] {
  const entry =
    (action: "label_added" | "label_removed") =>
    (label: Label): HistoryInput => ({
      action,
      userId,
      metadata: { labelName: label.name, labelColor: label.color },
    });
  return [...added.map(entry("label_added")), ...removed.map(entry("label_removed"))];
}

/** Queue history entries onto a batch, alongside the change they describe. */
export function addHistory(
  db: Firestore,
  batch: WriteBatch,
  boardId: string,
  taskId: string,
  entries: HistoryInput[],
): void {
  const history = taskDoc(db, boardId, taskId).collection("history");
  for (const entry of entries) {
    batch.set(history.doc(), { ...entry, createdAt: FieldValue.serverTimestamp() });
  }
}
