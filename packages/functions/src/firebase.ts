import { getApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// firebase-functions verifies callable auth tokens before our handler runs and
// registers its own named `__FIREBASE_FUNCTIONS_SDK__` admin app if no default
// exists — so `getApps().length === 0` is a lying guard here. Probe for the
// default app directly instead; `getApp()` throws when it's missing.
function ensureApp(): void {
  try {
    getApp();
  } catch {
    initializeApp();
  }
}

// Hand back the Admin Firestore instance, initializing the app if needed.
export function getDb(): Firestore {
  ensureApp();
  return getFirestore();
}

// Hand back the project's default Storage bucket, initializing the app if
// needed. Used for board-scoped cleanup (backgrounds + task attachments).
export function getBucket() {
  ensureApp();
  return getStorage().bucket();
}
