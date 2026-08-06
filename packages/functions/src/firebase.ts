import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Lazily initialize the Admin SDK exactly once. Guarding on getApps() keeps
// repeat calls (and hot-reloaded test modules) from throwing "app already
// exists".
function ensureApp(): void {
  if (getApps().length === 0) {
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
