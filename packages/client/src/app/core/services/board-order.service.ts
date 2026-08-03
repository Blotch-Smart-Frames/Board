import { Service, inject } from '@angular/core';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FIRESTORE_DB } from '../firebase/firebase.config';

@Service()
export class BoardOrderService {
  private readonly db = inject(FIRESTORE_DB);

  private boardOrderRef(userId: string) {
    return doc(this.db, 'users', userId, 'preferences', 'boardOrder');
  }

  async getBoardOrder(userId: string): Promise<Record<string, string>> {
    const snapshot = await getDoc(this.boardOrderRef(userId));
    const data = snapshot.data();
    return (data?.['boards'] as Record<string, string> | undefined) ?? {};
  }

  async setBoardOrder(userId: string, boardId: string, order: string): Promise<void> {
    await setDoc(this.boardOrderRef(userId), { boards: { [boardId]: order } }, { merge: true });
  }
}
