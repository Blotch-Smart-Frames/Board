import { Service, inject } from '@angular/core';
import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { FIREBASE_STORAGE } from '../firebase/firebase.config';
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_SIZE,
  MAX_BACKGROUND_IMAGE_SIZE,
} from '../../shared/utils/file-utils';
import type { Attachment } from '../../shared/types/board';

const BACKGROUND_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

@Service()
export class StorageService {
  private readonly storage = inject(FIREBASE_STORAGE);

  async uploadBoardBackground(boardId: string, file: File): Promise<string> {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new Error('Only JPEG, PNG, and WebP images are allowed for board backgrounds.');
    }
    if (file.size > MAX_BACKGROUND_IMAGE_SIZE) {
      throw new Error('Background image must be smaller than 5 MB.');
    }

    const extension = file.type.split('/')[1];
    const storageRef = ref(this.storage, `boards/${boardId}/background.${extension}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }

  uploadTaskAttachment(
    boardId: string,
    taskId: string,
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<Attachment> {
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      return Promise.reject(new Error('Only images and videos are allowed as attachments.'));
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      return Promise.reject(new Error('Attachment must be smaller than 25 MB.'));
    }

    const attachmentId = crypto.randomUUID();
    // String.prototype.split always returns at least one element, so `.pop()`
    // here is only typed as `string | undefined` for TS — never at runtime.
    const extension = file.name.split('.').pop() as string;
    const storagePath = `boards/${boardId}/tasks/${taskId}/attachments/${attachmentId}.${extension}`;
    const storageRef = ref(this.storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise<Attachment>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          onProgress?.((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        },
        reject,
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadUrl) => {
            resolve({
              id: attachmentId,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              storagePath,
              downloadUrl,
              uploadedAt: Date.now(),
            });
          }, reject);
        },
      );
    });
  }

  async deleteTaskAttachment(storagePath: string): Promise<void> {
    await deleteObject(ref(this.storage, storagePath));
  }

  async deleteBoardBackground(boardId: string): Promise<void> {
    for (const extension of BACKGROUND_EXTENSIONS) {
      try {
        await deleteObject(ref(this.storage, `boards/${boardId}/background.${extension}`));
        return;
      } catch {
        // try the next extension
      }
    }
  }
}
