import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from '../config/firebase';
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE,
} from '../utils/fileUtils';
import type { Attachment } from '../types/board';

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

export const uploadTaskAttachment = (
  boardId: string,
  taskId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<Attachment> => {
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
    return Promise.reject(
      new Error(
        'Invalid file type. Only JPEG, PNG, WebP images and MP4, QuickTime, WebM videos are allowed.',
      ),
    );
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    return Promise.reject(new Error('File size exceeds 25 MB limit.'));
  }

  const attachmentId = crypto.randomUUID();
  const ext = file.name.split('.').pop() || 'bin';
  const storagePath = `boards/${boardId}/tasks/${taskId}/attachments/${attachmentId}.${ext}`;
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      reject,
      async () => {
        const downloadUrl = await getDownloadURL(storageRef);
        resolve({
          id: attachmentId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          storagePath,
          downloadUrl,
          uploadedAt: Date.now(),
        });
      },
    );
  });
};

export const deleteTaskAttachment = async (
  storagePath: string,
): Promise<void> => {
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
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
