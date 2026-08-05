import { TestBed } from '@angular/core/testing';
import { doc, getDoc, getDocs, setDoc, where } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { FIRESTORE_DB } from '../firebase/firebase.config';
import { UserService } from './user.service';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  query: vi.fn((collectionRef: unknown, ...constraints: unknown[]) => ({
    collectionRef,
    constraints,
  })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: FIRESTORE_DB, useValue: {} }] });
    service = TestBed.inject(UserService);
  });

  describe('syncUserProfile', () => {
    it('lower-cases the email and defaults missing fields, merging into the doc', async () => {
      vi.mocked(setDoc).mockResolvedValue(undefined);

      await service.syncUserProfile({
        uid: 'u1',
        email: 'Jane@Example.com',
        displayName: null,
        photoURL: null,
      } as FirebaseUser);

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ email: 'jane@example.com', displayName: '', photoURL: null }),
        { merge: true },
      );
    });

    it('swallows errors instead of throwing', async () => {
      vi.mocked(setDoc).mockRejectedValue(new Error('offline'));

      await expect(
        service.syncUserProfile({ uid: 'u1', email: 'a@b.com' } as FirebaseUser),
      ).resolves.toBeUndefined();
    });

    it('falls back to an empty email string when the FirebaseUser has none', async () => {
      await service.syncUserProfile({
        uid: 'u1',
        email: null,
        displayName: 'Jane',
        photoURL: null,
      } as unknown as FirebaseUser);

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ email: '' }),
        { merge: true },
      );
    });
  });

  describe('getUserByEmail', () => {
    it('queries by lower-cased email and returns the first match', async () => {
      vi.mocked(getDocs).mockResolvedValue({
        docs: [{ id: 'u1', data: () => ({ email: 'a@b.com', displayName: 'A' }) }],
      } as never);

      const user = await service.getUserByEmail('A@B.com');

      expect(where).toHaveBeenCalledWith('email', '==', 'a@b.com');
      expect(user).toEqual({ id: 'u1', email: 'a@b.com', displayName: 'A' });
    });

    it('returns null when no user matches', async () => {
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);

      expect(await service.getUserByEmail('nobody@example.com')).toBeNull();
    });
  });

  describe('getUserById', () => {
    it('returns null for a missing doc', async () => {
      vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);

      expect(await service.getUserById('missing')).toBeNull();
    });
  });

  describe('getUsersByIds', () => {
    it('short-circuits on an empty array', async () => {
      expect(await service.getUsersByIds([])).toEqual([]);
      expect(getDoc).not.toHaveBeenCalled();
    });

    it('filters out ids that resolve to no user', async () => {
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'u1',
          data: () => ({ email: 'a@b.com' }),
        } as never)
        .mockResolvedValueOnce({ exists: () => false } as never);

      expect(await service.getUsersByIds(['u1', 'missing'])).toEqual([
        { id: 'u1', email: 'a@b.com' },
      ]);
    });
  });
});
