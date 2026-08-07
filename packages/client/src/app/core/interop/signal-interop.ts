import { computed, type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap } from 'rxjs';
import {
  onSnapshot,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type Query,
} from 'firebase/firestore';
import { onAuthStateChanged, type Auth, type User } from 'firebase/auth';

/**
 * Bridges a reactive Firestore document reference into a signal of its data.
 * Re-subscribes via switchMap whenever the ref changes (e.g. a different
 * boardId), immediately clearing to `undefined` first so a new subscription
 * never briefly shows the previous document's data.
 */
export function docSignal<T>(
  refFn: () => DocumentReference<DocumentData> | null,
): Signal<T | null | undefined> {
  const value$ = toObservable(computed(refFn)).pipe(
    switchMap((ref) => {
      if (!ref) return of(null);
      return new Observable<T | null | undefined>((subscriber) => {
        subscriber.next(undefined);
        return onSnapshot(
          ref,
          (snapshot) => {
            subscriber.next(
              snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null,
            );
          },
          (error) => {
            console.error(error);
            subscriber.next(null);
          },
        );
      });
    }),
  );

  return toSignal(value$, { initialValue: undefined });
}

/**
 * Bridges a reactive Firestore collection/query into a signal of its docs.
 * Same switchMap-based resubscription and stale-data-clearing as docSignal.
 */
export function collectionSignal<T>(
  queryFn: () => Query<DocumentData> | CollectionReference<DocumentData> | null,
): Signal<T[] | undefined> {
  const value$ = toObservable(computed(queryFn)).pipe(
    switchMap((queryOrCollection) => {
      if (!queryOrCollection) return of([]);
      return new Observable<T[] | undefined>((subscriber) => {
        subscriber.next(undefined);
        return onSnapshot(
          queryOrCollection,
          (snapshot) => {
            subscriber.next(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
          },
          (error) => {
            console.error(error);
            subscriber.next([]);
          },
        );
      });
    }),
  );

  return toSignal(value$, { initialValue: undefined });
}

/** Bridges Firebase Auth's callback-based state into a signal. `undefined` until the first callback fires. */
export function authStateSignal(auth: Auth): Signal<User | null | undefined> {
  const value$ = new Observable<User | null>((subscriber) =>
    onAuthStateChanged(auth, (user) => subscriber.next(user)),
  );

  return toSignal(value$, { initialValue: undefined });
}
