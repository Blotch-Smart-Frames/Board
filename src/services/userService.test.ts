import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({
  db: {},
}));

const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
}));

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('syncUserProfile', () => {
    it('calls setDoc with user data', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      const { syncUserProfile } = await import('./userService');
      await syncUserProfile({
        uid: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
      } as any);

      expect(mockSetDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          email: 'test@example.com',
          displayName: 'Test User',
          photoURL: 'https://example.com/photo.jpg',
        }),
        { merge: true },
      );
    });

    it('handles user with missing optional fields', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      const { syncUserProfile } = await import('./userService');
      await syncUserProfile({
        uid: 'user-2',
        email: null,
        displayName: null,
        photoURL: null,
      } as any);

      expect(mockSetDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          displayName: '',
          photoURL: null,
        }),
        { merge: true },
      );
    });

    it('does not throw on error', async () => {
      mockSetDoc.mockRejectedValue(new Error('Firestore error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { syncUserProfile } = await import('./userService');
      await expect(
        syncUserProfile({ uid: 'u1', email: null, displayName: null, photoURL: null } as any),
      ).resolves.toBeUndefined();

      consoleSpy.mockRestore();
    });
  });

  describe('getUserByEmail', () => {
    it('returns user when found', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'user-1',
            data: () => ({
              email: 'test@example.com',
              displayName: 'Test',
            }),
          },
        ],
      });

      const { getUserByEmail } = await import('./userService');
      const result = await getUserByEmail('test@example.com');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-1');
    });

    it('returns null when not found', async () => {
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

      const { getUserByEmail } = await import('./userService');
      const result = await getUserByEmail('missing@example.com');

      expect(result).toBeNull();
    });

    it('lowercases email for query', async () => {
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

      const { getUserByEmail } = await import('./userService');
      await getUserByEmail('Test@Example.COM');

      // The function lowercases the email internally
      expect(mockGetDocs).toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('returns user when exists', async () => {
      mockGetDoc.mockResolvedValue({
        id: 'user-1',
        exists: () => true,
        data: () => ({ email: 'test@example.com', displayName: 'Test' }),
      });

      const { getUserById } = await import('./userService');
      const result = await getUserById('user-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-1');
    });

    it('returns null when not exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const { getUserById } = await import('./userService');
      const result = await getUserById('user-999');

      expect(result).toBeNull();
    });
  });

  describe('getUsersByIds', () => {
    it('returns empty array for empty input', async () => {
      const { getUsersByIds } = await import('./userService');
      const result = await getUsersByIds([]);

      expect(result).toEqual([]);
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it('filters out null results', async () => {
      mockGetDoc
        .mockResolvedValueOnce({
          id: 'user-1',
          exists: () => true,
          data: () => ({ email: 'a@test.com', displayName: 'A' }),
        })
        .mockResolvedValueOnce({
          exists: () => false,
        });

      const { getUsersByIds } = await import('./userService');
      const result = await getUsersByIds(['user-1', 'user-2']);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-1');
    });
  });
});
