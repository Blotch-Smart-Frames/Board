import { TestBed } from '@angular/core/testing';
import {
  FIREBASE_APP,
  FIREBASE_AUTH,
  FIREBASE_FUNCTIONS,
  FIRESTORE_DB,
  FIREBASE_STORAGE,
  GOOGLE_AUTH_PROVIDER,
} from './firebase.config';

// The real Firebase SDK boots the network stack in the token factories, which
// would blow up in a jsdom environment. Every factory is stubbed so we can
// confirm the tokens exist, are unique, and can be resolved from the injector.
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'test-app' })),
}));

vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider {
    readonly scopes: string[] = [];
    addScope(scope: string): void {
      this.scopes.push(scope);
    }
  }
  return {
    getAuth: vi.fn(() => ({ mock: 'auth' })),
    setPersistence: vi.fn(),
    browserLocalPersistence: { type: 'LOCAL' },
    GoogleAuthProvider: MockGoogleAuthProvider,
  };
});

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ mock: 'firestore' })),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({ mock: 'functions' })),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({ mock: 'storage' })),
}));

describe('firebase config injection tokens', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('provides a Firebase app instance from FIREBASE_APP', () => {
    expect(TestBed.inject(FIREBASE_APP)).toEqual({ name: 'test-app' });
  });

  it('provides a Firestore instance built off the app', () => {
    expect(TestBed.inject(FIRESTORE_DB)).toEqual({ mock: 'firestore' });
  });

  it('provides an Auth instance and applies local persistence', async () => {
    const auth = TestBed.inject(FIREBASE_AUTH);
    expect(auth).toEqual({ mock: 'auth' });
    const { setPersistence, browserLocalPersistence } = await import('firebase/auth');
    expect(setPersistence).toHaveBeenCalledWith(auth, browserLocalPersistence);
  });

  it('provides a Storage instance', () => {
    expect(TestBed.inject(FIREBASE_STORAGE)).toEqual({ mock: 'storage' });
  });

  it('provides a Functions instance pinned to us-central1', async () => {
    expect(TestBed.inject(FIREBASE_FUNCTIONS)).toEqual({ mock: 'functions' });
    const { getFunctions } = await import('firebase/functions');
    expect(getFunctions).toHaveBeenCalledWith(expect.anything(), 'us-central1');
  });

  it('provides a GoogleAuthProvider with calendar scopes', () => {
    const provider = TestBed.inject(GOOGLE_AUTH_PROVIDER) as unknown as { scopes: string[] };
    expect(provider.scopes).toEqual([
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ]);
  });
});
