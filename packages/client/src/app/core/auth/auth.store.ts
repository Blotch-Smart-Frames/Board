import { Service, inject, signal, computed } from '@angular/core';
import { FIREBASE_AUTH } from '../firebase/firebase.config';
import { authStateSignal } from '../interop/signal-interop';
import { AuthService } from './auth.service';
import { UserService } from '../services/user.service';
import { CalendarService } from '../services/calendar.service';

/**
 * Live auth state plus the login/logout actions. Unlike BoardStore this is a
 * true app-wide singleton (one signed-in user per session), so it's a root
 * @Service() rather than route-scoped.
 */
@Service()
export class AuthStore {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly calendarService = inject(CalendarService);

  readonly user = authStateSignal(this.auth);
  readonly accessToken = signal<string | null>(null);

  readonly isAuthReady = computed(() => this.user() !== undefined);
  readonly isAuthenticated = computed(() => !!this.user());

  async login(): Promise<void> {
    const { user, accessToken } = await this.authService.signInWithGoogle();
    this.accessToken.set(accessToken);
    this.calendarService.setAccessToken(accessToken);
    await this.userService.syncUserProfile(user);
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
    this.accessToken.set(null);
  }
}
