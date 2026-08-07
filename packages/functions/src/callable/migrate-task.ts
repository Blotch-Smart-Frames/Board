import { logger } from "firebase-functions/v2";
import {
  onCall,
  HttpsError,
  type CallableRequest,
} from "firebase-functions/v2/https";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { Board, Task } from "@blotch/model";
import { getDb } from "../firebase";
import { getOrderAtEnd } from "../util/ordering";

// Same 500-writes-per-batch limit Firestore enforces on the client SDK.
const BATCH_LIMIT = 500;

export type MigrateTaskRequest = {
  sourceBoardId: string;
  taskId: string;
  targetBoardId: string;
  targetListId: string;
};

export type MigrateTaskResponse = {
  newTaskId: string;
};

export type MigrateTaskDeps = {
  db: Firestore;
};

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpsError("invalid-argument", `"${field}" is required.`);
  }
  return value;
}

function assertMember(
  board: Board | undefined,
  uid: string,
  kind: "source" | "target",
): asserts board is Board {
  if (!board) {
    throw new HttpsError("not-found", `The ${kind} board no longer exists.`);
  }
  if (board.ownerId !== uid && !(board.collaborators ?? []).includes(uid)) {
    throw new HttpsError(
      "permission-denied",
      `You are not a member of the ${kind} board.`,
    );
  }
}

/**
 * Migrates a task (with its comments and history) from one board to another
 * using admin credentials, so cross-board writes bypass client Firestore rules
 * that would otherwise reject:
 *   - copying comments whose original `authorId` is not the migrator's uid;
 *   - copying/deleting history entries when the migrator isn't the source
 *     board's owner.
 *
 * Membership on both boards is enforced server-side by reading each board doc
 * and matching the caller's uid to `ownerId` or `collaborators`. Labels and
 * sprints are per-board references and are dropped; attachments keep their
 * source storage path (the user is assumed to remain a member of the source
 * board's storage bucket).
 *
 * The write phase (target task + copied comments/history + `board_migrated`
 * marker) commits before the source delete phase, matching the client's
 * previous ordering: if the delete phase fails, the target copy still exists
 * and no data is lost.
 */
export async function runMigrateTask(
  request: CallableRequest<unknown>,
  deps?: Partial<MigrateTaskDeps>,
): Promise<MigrateTaskResponse> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const data = (request.data ?? {}) as Record<string, unknown>;
  const sourceBoardId = requireString(data.sourceBoardId, "sourceBoardId");
  const taskId = requireString(data.taskId, "taskId");
  const targetBoardId = requireString(data.targetBoardId, "targetBoardId");
  const targetListId = requireString(data.targetListId, "targetListId");

  if (sourceBoardId === targetBoardId) {
    throw new HttpsError(
      "failed-precondition",
      "Cannot migrate task to the same board.",
    );
  }

  const db = deps?.db ?? getDb();

  const sourceBoardRef = db.collection("boards").doc(sourceBoardId);
  const targetBoardRef = db.collection("boards").doc(targetBoardId);
  const sourceTaskRef = sourceBoardRef.collection("tasks").doc(taskId);
  const targetListRef = targetBoardRef.collection("lists").doc(targetListId);
  const targetTasksRef = targetBoardRef.collection("tasks");

  const [
    sourceBoardSnap,
    targetBoardSnap,
    taskSnap,
    commentsSnap,
    historySnap,
    targetListSnap,
    targetTasksSnap,
  ] = await Promise.all([
    sourceBoardRef.get(),
    targetBoardRef.get(),
    sourceTaskRef.get(),
    sourceTaskRef.collection("comments").get(),
    sourceTaskRef.collection("history").get(),
    targetListRef.get(),
    targetTasksRef.where("listId", "==", targetListId).get(),
  ]);

  const sourceBoard = sourceBoardSnap.exists
    ? (sourceBoardSnap.data() as Board)
    : undefined;
  const targetBoard = targetBoardSnap.exists
    ? (targetBoardSnap.data() as Board)
    : undefined;
  assertMember(sourceBoard, uid, "source");
  assertMember(targetBoard, uid, "target");

  if (!taskSnap.exists) {
    throw new HttpsError("not-found", "Task not found.");
  }
  if (!targetListSnap.exists) {
    throw new HttpsError("not-found", "Target list does not exist.");
  }

  const source = taskSnap.data() as Task;
  const newOrder = getOrderAtEnd(
    targetTasksSnap.docs.map((d) => d.data() as Task),
  );
  const newTaskRef = targetTasksRef.doc();

  const writes = db.batch();
  writes.set(newTaskRef, {
    listId: targetListId,
    title: source.title,
    description: source.description ?? "",
    order: newOrder,
    startDate: source.startDate ?? null,
    dueDate: source.dueDate ?? null,
    calendarEventId: source.calendarEventId ?? null,
    calendarSyncEnabled: source.calendarSyncEnabled ?? false,
    archive: source.archive ?? false,
    archivedAt: source.archivedAt ?? null,
    createdBy: source.createdBy,
    assignedTo: source.assignedTo ?? [],
    // Labels/sprints belong to the source board's collections — dropped.
    labelIds: [],
    color: source.color ?? null,
    attachments: source.attachments ?? [],
    commentCount: source.commentCount ?? 0,
    createdAt: source.createdAt,
    updatedAt: FieldValue.serverTimestamp(),
  });

  for (const commentDoc of commentsSnap.docs) {
    writes.set(
      newTaskRef.collection("comments").doc(commentDoc.id),
      commentDoc.data(),
    );
  }

  for (const historyDoc of historySnap.docs) {
    writes.set(
      newTaskRef.collection("history").doc(historyDoc.id),
      historyDoc.data(),
    );
  }

  writes.set(newTaskRef.collection("history").doc(), {
    action: "board_migrated",
    userId: uid,
    metadata: {
      fromBoardName: sourceBoard.title,
      toBoardName: targetBoard.title,
    },
    createdAt: FieldValue.serverTimestamp(),
  });

  await writes.commit();

  const deleteRefs = [
    ...commentsSnap.docs.map((d) => d.ref),
    ...historySnap.docs.map((d) => d.ref),
    sourceTaskRef,
  ];
  for (let i = 0; i < deleteRefs.length; i += BATCH_LIMIT) {
    const chunk = deleteRefs.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const ref of chunk) batch.delete(ref);
    await batch.commit();
  }

  logger.info("Task migrated", {
    uid,
    sourceBoardId,
    taskId,
    targetBoardId,
    newTaskId: newTaskRef.id,
  });

  return { newTaskId: newTaskRef.id };
}

export const migrateTask = onCall({ region: "us-central1" }, (request) =>
  runMigrateTask(request),
);
