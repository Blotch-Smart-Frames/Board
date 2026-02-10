import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string }> => {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = await result.user.getIdTokenResult();

  // Get the OAuth access token for Google Calendar API
  // Note: This requires the credential from the sign-in result
  const oauthCredential = await signInWithPopup(auth, googleProvider);
  const token = (oauthCredential as unknown as { _tokenResponse?: { oauthAccessToken?: string } })
    ?._tokenResponse?.oauthAccessToken || '';

  return {
    user: result.user,
    accessToken: token || credential.token,
  };
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

export const onAuthChange = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, callback);
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const getIdToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
};
