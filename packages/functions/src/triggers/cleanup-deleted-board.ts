import { logger } from "firebase-functions/v2";
import {
  onDocumentDeleted,
  type FirestoreEvent,
  type QueryDocumentSnapshot,
} from "firebase-functions/v2/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { getBucket, getDb } from "../firebase";

// Injectable so unit tests can pass a fake Firestore + a spy file-remover
// instead of standing up the Admin SDK / Cloud Storage.
export type CleanupDeps = {
  db: Firestore;
  deleteBoardFiles: (boardId: string) => Promise<void>;
};

// Best-effort removal of every Storage object under a board's prefix — both the
// background image (boards/{id}/background.*) and task attachments
// (boards/{id}/tasks/{taskId}/attachments/*). Runs via the Admin SDK, which
// bypasses Storage rules, so it works even though the board doc is already gone.
async function defaultDeleteBoardFiles(boardId: string): Promise<void> {
  await getBucket().deleteFiles({ prefix: `boards/${boardId}/` });
}

/**
 * Cascades cleanup when a board document is deleted. The client only deletes the
 * board doc itself (an owner-only, single-doc write); everything underneath is
 * torn down here with the Admin SDK:
 *   - Firestore: recursively delete lists, tasks (with their comments and
 *     history), labels and sprints under boards/{boardId}.
 *   - Storage: delete every object under boards/{boardId}/.
 *
 * Doing this server-side avoids the client's member-permission limits and the
 * rule-ordering leak where Storage deletes were denied because the board doc
 * they authorized against had already been removed. Errors propagate so the
 * trigger retries rather than silently leaving data orphaned.
 */
export async function runCleanupDeletedBoard(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, { boardId: string }>,
  deps?: Partial<CleanupDeps>,
): Promise<void> {
  const db = deps?.db ?? getDb();
  const deleteBoardFiles = deps?.deleteBoardFiles ?? defaultDeleteBoardFiles;
  const { boardId } = event.params;

  logger.info("Board cleanup started", { boardId });

  // Deleting a document does not remove its subcollections, so recurse from the
  // (now-deleted) board doc ref to purge everything still hanging beneath it.
  await db.recursiveDelete(db.collection("boards").doc(boardId));
  await deleteBoardFiles(boardId);

  logger.info("Board cleanup finished", { boardId });
}

export const cleanupDeletedBoard = onDocumentDeleted(
  { document: "boards/{boardId}", region: "us-central1", retry: true },
  runCleanupDeletedBoard,
);
