import {
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

export const signInWithGoogle = async (): Promise<void> => {
  await signInWithRedirect(auth, googleProvider);
};

export type RedirectAuthResult = {
  user: User;
  accessToken: string;
} | null;

export const handleRedirectResult = async (): Promise<RedirectAuthResult> => {
  const result = await getRedirectResult(auth);
  if (!result) {
    return null;
  }

  const token =
    (result as unknown as { _tokenResponse?: { oauthAccessToken?: string } })
      ?._tokenResponse?.oauthAccessToken || '';

  return {
    user: result.user,
    accessToken: token,
  };
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

export const onAuthChange = (
  callback: (user: User | null) => void,
): (() => void) => {
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
