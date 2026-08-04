import { TestBed } from '@angular/core/testing';
import { signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { FIREBASE_AUTH, GOOGLE_AUTH_PROVIDER } from '../firebase/firebase.config';
import { AuthService } from './auth.service';

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: { credentialFromResult: vi.fn() },
}));

describe('AuthService', () => {
  let service: AuthService;
  const fakeAuth = { name: 'fake-auth' };
  const fakeProvider = { name: 'fake-provider' };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: FIREBASE_AUTH, useValue: fakeAuth },
        { provide: GOOGLE_AUTH_PROVIDER, useValue: fakeProvider },
      ],
    });
    service = TestBed.inject(AuthService);
  });

  describe('signInWithGoogle', () => {
    it('signs in with the injected auth/provider and extracts the Calendar access token', async () => {
      const user = { uid: 'u1' };
      vi.mocked(signInWithPopup).mockResolvedValue({ user } as never);
      vi.mocked(GoogleAuthProvider.credentialFromResult).mockReturnValue({
        accessToken: 'gcal-token',
      } as never);

      const result = await service.signInWithGoogle();

      expect(signInWithPopup).toHaveBeenCalledWith(fakeAuth, fakeProvider);
      expect(result).toEqual({ user, accessToken: 'gcal-token' });
    });

    it('falls back to an empty access token if credential extraction fails', async () => {
      vi.mocked(signInWithPopup).mockResolvedValue({ user: { uid: 'u1' } } as never);
      vi.mocked(GoogleAuthProvider.credentialFromResult).mockReturnValue(null);

      const result = await service.signInWithGoogle();

      expect(result.accessToken).toBe('');
    });
  });

  describe('signOut', () => {
    it('signs out of the injected auth instance', async () => {
      vi.mocked(signOut).mockResolvedValue(undefined);

      await service.signOut();

      expect(signOut).toHaveBeenCalledWith(fakeAuth);
    });
  });
});
