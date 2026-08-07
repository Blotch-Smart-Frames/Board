/**
 * One-off migration to align existing task documents with the new archive model:
 *
 *  1. Removes the deprecated `completedAt` field from every task.
 *  2. Stamps `archivedAt` on tasks where `archive === true` but `archivedAt` is
 *     unset — falls back to the task's `updatedAt` (best available proxy for
 *     "when it was archived") and finally `createdAt`.
 *
 * Idempotent: rerunning does not overwrite an existing `archivedAt` and
 * touches nothing on tasks that don't need either change.
 *
 * Run with credentials for the target project, e.g.:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/keys/board-prod.json \
 *     npx tsx packages/functions/scripts/migrate-archive-model.ts
 *
 * Pass `--dry-run` to print the intended changes without writing.
 */
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

type TaskDoc = {
  archive?: boolean;
  archivedAt?: Timestamp;
  completedAt?: Timestamp;
  updatedAt?: Timestamp;
  createdAt?: Timestamp;
};

// Firestore write batches cap at 500 ops; leave headroom for retries.
const BATCH_LIMIT = 400;

function ensureApp(): void {
  if (getApps().length === 0) initializeApp();
}

async function run(dryRun: boolean): Promise<void> {
  ensureApp();
  const db: Firestore = getFirestore();

  const snapshot = await db.collectionGroup("tasks").get();
  console.log(`Scanning ${snapshot.size} task docs...`);

  let batch = db.batch();
  let batchOps = 0;
  let touched = 0;
  let backfilled = 0;
  let clearedCompletedAt = 0;

  async function flush(): Promise<void> {
    if (batchOps === 0) return;
    if (!dryRun) await batch.commit();
    batch = db.batch();
    batchOps = 0;
  }

  for (const doc of snapshot.docs) {
    const data = doc.data() as TaskDoc;
    const update: Record<string, unknown> = {};

    if ("completedAt" in data) {
      update.completedAt = FieldValue.delete();
      clearedCompletedAt++;
    }

    if (data.archive === true && !data.archivedAt) {
      // updatedAt is the closest approximation of "when it was archived"; fall
      // back to createdAt so the field is always populated.
      update.archivedAt = data.updatedAt ?? data.createdAt ?? Timestamp.now();
      backfilled++;
    }

    if (Object.keys(update).length === 0) continue;
    touched++;

    if (dryRun) {
      console.log(`would update ${doc.ref.path}`, update);
      continue;
    }

    batch.update(doc.ref, update);
    batchOps++;
    if (batchOps >= BATCH_LIMIT) await flush();
  }

  await flush();

  console.log(
    `Done. touched=${touched} clearedCompletedAt=${clearedCompletedAt} backfilledArchivedAt=${backfilled} dryRun=${dryRun}`,
  );
}

const dryRun = process.argv.includes("--dry-run");
run(dryRun).catch((err) => {
  console.error(err);
  process.exit(1);
});
