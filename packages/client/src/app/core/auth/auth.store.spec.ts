import { TestBed } from '@angular/core/testing';
import { onAuthStateChanged } from 'firebase/auth';
import { FIREBASE_AUTH } from '../firebase/firebase.config';
import { AuthService } from './auth.service';
import { UserService } from '../services/user.service';
import { CalendarService } from '../services/calendar.service';
import { AuthStore } from './auth.store';

type AuthCallback = (user: unknown) => void;

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
}));

describe('AuthStore', () => {
  let authService: {
    signInWithGoogle: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
  let userService: { syncUserProfile: ReturnType<typeof vi.fn> };
  let calendarService: { setAccessToken: ReturnType<typeof vi.fn> };
  let authCallback: AuthCallback;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = { signInWithGoogle: vi.fn(), signOut: vi.fn().mockResolvedValue(undefined) };
    userService = { syncUserProfile: vi.fn().mockResolvedValue(undefined) };
    calendarService = { setAccessToken: vi.fn() };

    vi.mocked(onAuthStateChanged).mockImplementation((_auth: unknown, callback: unknown) => {
      authCallback = callback as AuthCallback;
      return vi.fn();
    });

    TestBed.configureTestingModule({
      providers: [
        { provide: FIREBASE_AUTH, useValue: {} },
        { provide: AuthService, useValue: authService },
        { provide: UserService, useValue: userService },
        { provide: CalendarService, useValue: calendarService },
      ],
    });
  });

  it('is not ready until Firebase fires its first auth-state callback', () => {
    const store = TestBed.inject(AuthStore);
    TestBed.flushEffects();

    expect(store.isAuthReady()).toBe(false);
    expect(store.isAuthenticated()).toBe(false);

    authCallback(null);

    expect(store.isAuthReady()).toBe(true);
    expect(store.isAuthenticated()).toBe(false);
  });

  it('reflects a signed-in user once the callback fires with one', () => {
    const store = TestBed.inject(AuthStore);
    TestBed.flushEffects();

    authCallback({ uid: 'u1' });

    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()).toEqual({ uid: 'u1' });
  });

  describe('login', () => {
    it('stores the access token, forwards it to CalendarService, and syncs the profile', async () => {
      const store = TestBed.inject(AuthStore);
      const user = { uid: 'u1' };
      authService.signInWithGoogle.mockResolvedValue({ user, accessToken: 'gcal-token' });

      await store.login();

      expect(store.accessToken()).toBe('gcal-token');
      expect(calendarService.setAccessToken).toHaveBeenCalledWith('gcal-token');
      expect(userService.syncUserProfile).toHaveBeenCalledWith(user);
    });
  });

  describe('logout', () => {
    it('signs out and clears the access token', async () => {
      const store = TestBed.inject(AuthStore);
      store.accessToken.set('stale-token');

      await store.logout();

      expect(authService.signOut).toHaveBeenCalled();
      expect(store.accessToken()).toBeNull();
    });
  });
});
