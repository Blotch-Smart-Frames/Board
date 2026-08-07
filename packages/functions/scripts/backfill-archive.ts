/**
 * One-off backfill: set `archive: false` on every task document that predates
 * the archive feature.
 *
 * Why it's needed: the board and dashboard now query tasks with
 * `where('archive', '==', false)`, and Firestore equality filters skip
 * documents that lack the field entirely. Without this backfill, tasks created
 * before the feature shipped would silently vanish from every board.
 *
 * Safe to re-run — it only writes to docs still missing the field.
 *
 * Run once:
 *   # Against the local emulator:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx tsx packages/functions/scripts/backfill-archive.ts
 *
 *   # Against a real project (needs Admin credentials):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *     npx tsx packages/functions/scripts/backfill-archive.ts
 */
import { getDb } from "../src/firebase";

// Stay well under Firestore's 500-writes-per-batch limit.
const BATCH_LIMIT = 400;

async function backfillArchive(): Promise<void> {
  const db = getDb();

  // A collection-group query sweeps the `tasks` subcollection under every board
  // in a single pass. No composite index is required for an unfiltered read.
  const snapshot = await db.collectionGroup("tasks").get();
  const missing = snapshot.docs.filter((doc) => doc.get("archive") === undefined);

  console.log(
    `Scanned ${snapshot.size} task(s); ${missing.length} missing \`archive\`.`,
  );

  let written = 0;
  for (let i = 0; i < missing.length; i += BATCH_LIMIT) {
    const chunk = missing.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const doc of chunk) {
      batch.update(doc.ref, { archive: false });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`Committed ${written}/${missing.length}`);
  }

  console.log("Backfill complete.");
}

backfillArchive().then(
  () => process.exit(0),
  (err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  },
);
