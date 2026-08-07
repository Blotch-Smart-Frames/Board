import { Service, inject } from '@angular/core';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { FIREBASE_AUTH, GOOGLE_AUTH_PROVIDER } from '../firebase/firebase.config';

export type SignInResult = {
  user: User;
  accessToken: string;
};

@Service()
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly googleProvider = inject(GOOGLE_AUTH_PROVIDER);

  async signInWithGoogle(): Promise<SignInResult> {
    const result = await signInWithPopup(this.auth, this.googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return { user: result.user, accessToken: credential?.accessToken ?? '' };
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
  }
}
