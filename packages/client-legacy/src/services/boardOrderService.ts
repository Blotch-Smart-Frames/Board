import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const getBoardOrderRef = (userId: string) =>
  doc(db, 'users', userId, 'preferences', 'boardOrder');

export const getBoardOrder = async (
  userId: string,
): Promise<Record<string, string>> => {
  const snap = await getDoc(getBoardOrderRef(userId));
  if (!snap.exists()) return {};
  return (snap.data().boards as Record<string, string>) ?? {};
};

export const setBoardOrder = async (
  userId: string,
  boardId: string,
  order: string,
): Promise<void> => {
  await setDoc(
    getBoardOrderRef(userId),
    { boards: { [boardId]: order } },
    { merge: true },
  );
};
