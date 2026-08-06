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

  /**
   * Persists one or more board order keys in a single merge write. Passing the
   * full set of boards touched by a reorder (not just the moved one) lets the
   * store pin boards that had no stored order yet, so they aren't re-synthesized
   * to the end of the list on the next render. Untouched boards keep their keys.
   */
  async setBoardOrders(userId: string, orders: Record<string, string>): Promise<void> {
    await setDoc(this.boardOrderRef(userId), { boards: orders }, { merge: true });
  }
}
