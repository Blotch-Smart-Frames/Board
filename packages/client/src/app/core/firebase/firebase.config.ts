import { InjectionToken, inject } from '@angular/core';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { environment } from '../../../environments/environment';

// Injection tokens (rather than plain module-level consts) so tests can
// override each Firebase SDK handle via TestBed instead of module-mocking —
// the Angular unit-test system doesn't support vi.mock for relative imports.

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP', {
  providedIn: 'root',
  factory: () =>
    initializeApp({
      apiKey: environment.firebase.apiKey,
      authDomain: environment.firebase.authDomain,
      projectId: environment.firebase.projectId,
      storageBucket: environment.firebase.storageBucket,
      messagingSenderId: environment.firebase.messagingSenderId,
      appId: environment.firebase.appId,
    }),
});

export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH', {
  providedIn: 'root',
  factory: () => {
    const auth = getAuth(inject(FIREBASE_APP));
    setPersistence(auth, browserLocalPersistence);
    return auth;
  },
});

export const FIRESTORE_DB = new InjectionToken<Firestore>('FIRESTORE_DB', {
  providedIn: 'root',
  factory: () => getFirestore(inject(FIREBASE_APP)),
});

export const FIREBASE_STORAGE = new InjectionToken<FirebaseStorage>('FIREBASE_STORAGE', {
  providedIn: 'root',
  factory: () => getStorage(inject(FIREBASE_APP)),
});

// Callable Cloud Functions are pinned to us-central1 to match the region the
// server-side callables (see packages/functions/src/callable) deploy to.
export const FIREBASE_FUNCTIONS = new InjectionToken<Functions>('FIREBASE_FUNCTIONS', {
  providedIn: 'root',
  factory: () => getFunctions(inject(FIREBASE_APP), 'us-central1'),
});

export const GOOGLE_AUTH_PROVIDER = new InjectionToken<GoogleAuthProvider>('GOOGLE_AUTH_PROVIDER', {
  providedIn: 'root',
  factory: () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/calendar');
    provider.addScope('https://www.googleapis.com/auth/calendar.events');
    return provider;
  },
});
