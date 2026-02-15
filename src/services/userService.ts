import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../config/firebase';
import type { User } from '../types/board';

export const syncUserProfile = async (user: FirebaseUser): Promise<void> => {
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(
      userRef,
      {
        email: user.email?.toLowerCase(),
        displayName: user.displayName || '',
        photoURL: user.photoURL || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error('Failed to sync user profile:', error);
  }
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const usersQuery = query(
    collection(db, 'users'),
    where('email', '==', email.toLowerCase()),
  );
  const snapshot = await getDocs(usersQuery);

  if (snapshot.empty) return null;

  const userDoc = snapshot.docs[0];
  return {
    id: userDoc.id,
    ...userDoc.data(),
  } as User;
};

export const getUserById = async (userId: string): Promise<User | null> => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return null;

  return {
    id: userDoc.id,
    ...userDoc.data(),
  } as User;
};

export const getUsersByIds = async (userIds: string[]): Promise<User[]> => {
  if (userIds.length === 0) return [];

  const users = await Promise.all(userIds.map(getUserById));
  return users.filter((user): user is User => user !== null);
};
