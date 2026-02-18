import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({
  auth: {},
  googleProvider: {},
}));

const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChanged = vi.fn();
const mockCredentialFromResult = vi.fn();

vi.mock('firebase/auth', () => ({
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  GoogleAuthProvider: {
    credentialFromResult: (...args: unknown[]) =>
      mockCredentialFromResult(...args),
  },
}));

describe('firebase service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signInWithGoogle', () => {
    it('returns user and access token', async () => {
      const mockUser = { uid: 'user-1', email: 'test@test.com' };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });
      mockCredentialFromResult.mockReturnValue({
        accessToken: 'google-token-123',
      });

      const { signInWithGoogle } = await import('./firebase');
      const result = await signInWithGoogle();

      expect(result.user).toEqual(mockUser);
      expect(result.accessToken).toBe('google-token-123');
    });

    it('returns empty access token when credential is null', async () => {
      mockSignInWithPopup.mockResolvedValue({
        user: { uid: 'user-1' },
      });
      mockCredentialFromResult.mockReturnValue(null);

      const { signInWithGoogle } = await import('./firebase');
      const result = await signInWithGoogle();

      expect(result.accessToken).toBe('');
    });
  });

  describe('signOut', () => {
    it('calls firebase signOut', async () => {
      mockSignOut.mockResolvedValue(undefined);

      const { signOut } = await import('./firebase');
      await signOut();

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('onAuthChange', () => {
    it('subscribes to auth state changes and returns unsubscribe', async () => {
      const unsubscribe = vi.fn();
      mockOnAuthStateChanged.mockReturnValue(unsubscribe);

      const { onAuthChange } = await import('./firebase');
      const callback = vi.fn();
      const unsub = onAuthChange(callback);

      expect(mockOnAuthStateChanged).toHaveBeenCalled();
      expect(unsub).toBe(unsubscribe);
    });
  });
});
