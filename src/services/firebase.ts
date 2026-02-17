import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

type PopupAuthResult = {
  user: User;
  accessToken: string;
};

export const signInWithGoogle = async (): Promise<PopupAuthResult> => {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  return {
    user: result.user,
    accessToken: credential?.accessToken ?? '',
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
