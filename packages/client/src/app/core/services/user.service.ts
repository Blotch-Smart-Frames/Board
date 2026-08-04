import { Service, inject } from '@angular/core';
import { collection, doc, getDoc, getDocs, setDoc, query, where, serverTimestamp } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { FIRESTORE_DB } from '../firebase/firebase.config';
import type { User } from '../../shared/types/board';

@Service()
export class UserService {
  private readonly db = inject(FIRESTORE_DB);

  private usersCollection() {
    return collection(this.db, 'users');
  }

  private userRef(userId: string) {
    return doc(this.db, 'users', userId);
  }

  async syncUserProfile(user: FirebaseUser): Promise<void> {
    try {
      await setDoc(
        this.userRef(user.uid),
        {
          email: (user.email ?? '').toLowerCase(),
          displayName: user.displayName ?? '',
          photoURL: user.photoURL ?? null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      console.error('Failed to sync user profile:', error);
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const snapshot = await getDocs(
      query(this.usersCollection(), where('email', '==', email.toLowerCase())),
    );
    const first = snapshot.docs[0];
    return first ? ({ id: first.id, ...first.data() } as User) : null;
  }

  async getUserById(userId: string): Promise<User | null> {
    const snapshot = await getDoc(this.userRef(userId));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as User) : null;
  }

  async getUsersByIds(userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) return [];
    const users = await Promise.all(userIds.map((id) => this.getUserById(id)));
    return users.filter((user): user is User => user !== null);
  }
}
