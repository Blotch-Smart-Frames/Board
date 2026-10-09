import { Service, inject } from '@angular/core';
import { deleteField, doc, getDoc, setDoc } from 'firebase/firestore';
import { FIRESTORE_DB } from '../firebase/firebase.config';

export interface BoardFolderData {
  name: string;
  order: string;
  collapsed?: boolean;
}

/**
 * The user's personal sidebar layout, kept in `users/{uid}/preferences/boardOrder`.
 * Folders are per-user (not on the board) so organizing your sidebar never
 * reshuffles a collaborator's.
 */
export interface BoardPreferences {
  /** Board id → fractional order key, scoped to the board's folder (or the root). */
  boards?: Record<string, string>;
  folders?: Record<string, BoardFolderData>;
  /** Board id → folder id. Boards absent here sit at the root. */
  boardFolders?: Record<string, string>;
}

/** A partial update to {@link BoardPreferences}; `null` removes the entry. */
export interface BoardPreferencesPatch {
  boards?: Record<string, string>;
  folders?: Record<string, Partial<BoardFolderData> | null>;
  boardFolders?: Record<string, string | null>;
}

type FirestoreMap = Record<string, unknown>;

function withDeletes(entries: Record<string, unknown>): FirestoreMap {
  return Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, value === null ? deleteField() : value]),
  );
}

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
   * Persists a sidebar layout change in a single merge write, so moving a board
   * into a folder updates its folder and order key atomically. Nested maps merge
   * key-by-key; untouched boards and folders keep their values.
   */
  async updatePreferences(userId: string, patch: BoardPreferencesPatch): Promise<void> {
    const data: FirestoreMap = {};
    if (patch.boards) data['boards'] = patch.boards;
    if (patch.folders) data['folders'] = withDeletes(patch.folders);
    if (patch.boardFolders) data['boardFolders'] = withDeletes(patch.boardFolders);
    await setDoc(this.boardOrderRef(userId), data, { merge: true });
  }
}
