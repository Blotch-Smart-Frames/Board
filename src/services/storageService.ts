import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from '../config/firebase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const uploadBoardBackground = async (
  boardId: string,
  file: File,
): Promise<string> => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('File size exceeds 5MB limit.');
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const storageRef = ref(storage, `boards/${boardId}/background.${ext}`);

  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

export const deleteBoardBackground = async (boardId: string): Promise<void> => {
  const extensions = ['jpg', 'jpeg', 'png', 'webp'];

  for (const ext of extensions) {
    try {
      const storageRef = ref(storage, `boards/${boardId}/background.${ext}`);
      await deleteObject(storageRef);
      return;
    } catch {
      // File with this extension doesn't exist, try next
    }
  }
};
