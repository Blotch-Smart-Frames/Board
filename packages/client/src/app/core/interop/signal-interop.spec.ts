import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import type { CollectionReference, DocumentReference, Query } from 'firebase/firestore';
import type { Auth, User } from 'firebase/auth';
import { authStateSignal, collectionSignal, docSignal } from './signal-interop';

// Capture the snapshot subscribers so tests can drive the "onSnapshot" flow
// synchronously — the real SDK is entirely stubbed to keep jsdom off the network.
type DocCb = (snap: { exists: () => boolean; id: string; data: () => unknown }) => void;
type ColCb = (snap: { docs: { id: string; data: () => unknown }[] }) => void;

const docCallbacks = new Map<unknown, { onNext: DocCb; onError: (err: unknown) => void }>();
const colCallbacks = new Map<
  unknown,
  { onNext: ColCb; onError: (err: unknown) => void; unsubscribe: () => void }
>();

vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn((ref: unknown, onNext: unknown, onError?: unknown) => {
    const unsubscribe = vi.fn();
    if (isDocRef(ref)) {
      docCallbacks.set(ref, { onNext: onNext as DocCb, onError: (onError as never) ?? (() => {}) });
    } else {
      colCallbacks.set(ref, {
        onNext: onNext as ColCb,
        onError: (onError as never) ?? (() => {}),
        unsubscribe,
      });
    }
    return unsubscribe;
  }),
}));

const authListeners: ((user: User | null) => void)[] = [];
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth: Auth, cb: (user: User | null) => void) => {
    authListeners.push(cb);
    return vi.fn();
  }),
}));

function isDocRef(ref: unknown): ref is { kind: 'doc' } {
  return !!ref && typeof ref === 'object' && 'kind' in ref && (ref as { kind: string }).kind === 'doc';
}

function fakeDocRef(id = 'doc-1') {
  return { kind: 'doc', id } as unknown as DocumentReference;
}
function fakeQuery(id = 'query-1') {
  return { kind: 'query', id } as unknown as Query;
}
function fakeCollection(id = 'col-1') {
  return { kind: 'collection', id } as unknown as CollectionReference;
}

async function flush() {
  TestBed.flushEffects();
  await Promise.resolve();
  TestBed.flushEffects();
}

beforeEach(() => {
  docCallbacks.clear();
  colCallbacks.clear();
  authListeners.length = 0;
  TestBed.configureTestingModule({});
});

describe('docSignal', () => {
  it('starts as undefined, then emits the merged snapshot data on the first callback', async () => {
    const ref = fakeDocRef('t1');
    const result = TestBed.runInInjectionContext(() =>
      docSignal<{ id: string; title: string }>(() => ref),
    );
    await flush();

    expect(result()).toBeUndefined();
    docCallbacks.get(ref)!.onNext({
      exists: () => true,
      id: 't1',
      data: () => ({ title: 'Hello' }),
    });
    await flush();

    expect(result()).toEqual({ id: 't1', title: 'Hello' });
  });

  it('emits null when the document does not exist', async () => {
    const ref = fakeDocRef();
    const result = TestBed.runInInjectionContext(() => docSignal(() => ref));
    await flush();

    docCallbacks.get(ref)!.onNext({ exists: () => false, id: 'x', data: () => ({}) });
    await flush();

    expect(result()).toBeNull();
  });

  it('emits null (no subscription) when the ref factory returns null', async () => {
    const result = TestBed.runInInjectionContext(() => docSignal(() => null));
    await flush();

    expect(result()).toBeNull();
    expect(docCallbacks.size).toBe(0);
  });

  it('resets to undefined between subscriptions when the ref changes', async () => {
    const refA = fakeDocRef('a');
    const refB = fakeDocRef('b');
    const ref = signal(refA);

    const result = TestBed.runInInjectionContext(() => docSignal(() => ref()));
    await flush();
    docCallbacks.get(refA)!.onNext({ exists: () => true, id: 'a', data: () => ({ v: 1 }) });
    await flush();
    expect(result()).toEqual({ id: 'a', v: 1 });

    ref.set(refB);
    await flush();
    // Stale-clear before the new subscription's first callback.
    expect(result()).toBeUndefined();

    docCallbacks.get(refB)!.onNext({ exists: () => true, id: 'b', data: () => ({ v: 2 }) });
    await flush();
    expect(result()).toEqual({ id: 'b', v: 2 });
  });

  it('emits null and logs when onSnapshot reports an error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ref = fakeDocRef();
    const result = TestBed.runInInjectionContext(() => docSignal(() => ref));
    await flush();

    docCallbacks.get(ref)!.onError(new Error('boom'));
    await flush();

    expect(result()).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('collectionSignal', () => {
  it('starts as undefined, then emits a docs array on the first callback', async () => {
    const q = fakeQuery();
    const result = TestBed.runInInjectionContext(() =>
      collectionSignal<{ id: string; title: string }>(() => q),
    );
    await flush();

    expect(result()).toBeUndefined();
    colCallbacks.get(q)!.onNext({
      docs: [
        { id: 'a', data: () => ({ title: 'A' }) },
        { id: 'b', data: () => ({ title: 'B' }) },
      ],
    });
    await flush();

    expect(result()).toEqual([
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ]);
  });

  it('accepts a CollectionReference in addition to a Query', async () => {
    const col = fakeCollection();
    const result = TestBed.runInInjectionContext(() => collectionSignal(() => col));
    await flush();

    colCallbacks.get(col)!.onNext({ docs: [{ id: 'x', data: () => ({}) }] });
    await flush();

    expect(result()).toEqual([{ id: 'x' }]);
  });

  it('emits an empty array (no subscription) when the query factory returns null', async () => {
    const result = TestBed.runInInjectionContext(() => collectionSignal(() => null));
    await flush();

    expect(result()).toEqual([]);
    expect(colCallbacks.size).toBe(0);
  });

  it('emits an empty array and logs on snapshot error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const q = fakeQuery();
    const result = TestBed.runInInjectionContext(() => collectionSignal(() => q));
    await flush();

    colCallbacks.get(q)!.onError(new Error('boom'));
    await flush();

    expect(result()).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('resubscribes when the query changes', async () => {
    const qA = fakeQuery('a');
    const qB = fakeQuery('b');
    const q = computed<Query | null>(() => (which() === 'a' ? qA : qB));
    const which = signal<'a' | 'b'>('a');

    TestBed.runInInjectionContext(() => collectionSignal(() => q()));
    await flush();
    expect(colCallbacks.get(qA)).toBeDefined();

    which.set('b');
    await flush();
    expect(colCallbacks.get(qB)).toBeDefined();
  });
});

describe('authStateSignal', () => {
  it('starts as undefined and then reflects the auth callback value', async () => {
    const auth = {} as Auth;
    const result = TestBed.runInInjectionContext(() => authStateSignal(auth));
    await flush();

    expect(result()).toBeUndefined();

    authListeners[0]({ uid: 'u1' } as User);
    await flush();
    expect(result()).toEqual({ uid: 'u1' });

    authListeners[0](null);
    await flush();
    expect(result()).toBeNull();
  });
});
