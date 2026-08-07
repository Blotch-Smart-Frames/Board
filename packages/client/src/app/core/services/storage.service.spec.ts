import { TestBed } from '@angular/core/testing';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  uploadBytesResumable,
} from 'firebase/storage';
import { FIREBASE_STORAGE } from '../firebase/firebase.config';
import { StorageService } from './storage.service';

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytes: vi.fn(),
  uploadBytesResumable: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
}));

function fakeFile(name: string, type: string, size: number): File {
  return { name, type, size } as File;
}

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: FIREBASE_STORAGE, useValue: {} }] });
    service = TestBed.inject(StorageService);
  });

  describe('uploadBoardBackground', () => {
    it('rejects unsupported file types', async () => {
      await expect(
        service.uploadBoardBackground('board-1', fakeFile('bg.gif', 'image/gif', 1000)),
      ).rejects.toThrow('Only JPEG, PNG, and WebP images are allowed');
      expect(uploadBytes).not.toHaveBeenCalled();
    });

    it('rejects files over 5 MB', async () => {
      await expect(
        service.uploadBoardBackground('board-1', fakeFile('bg.png', 'image/png', 6 * 1024 * 1024)),
      ).rejects.toThrow('smaller than 5 MB');
    });

    it('uploads to a fixed path derived from the mime type and returns the download URL', async () => {
      vi.mocked(uploadBytes).mockResolvedValue(undefined as never);
      vi.mocked(getDownloadURL).mockResolvedValue('https://example.com/bg.png');

      const url = await service.uploadBoardBackground(
        'board-1',
        fakeFile('x.png', 'image/png', 1000),
      );

      expect(ref).toHaveBeenCalledWith(expect.anything(), 'boards/board-1/background.png');
      expect(url).toBe('https://example.com/bg.png');
    });
  });

  describe('uploadTaskAttachment', () => {
    it('rejects disallowed types without ever calling uploadBytesResumable', async () => {
      await expect(
        service.uploadTaskAttachment(
          'board-1',
          'task-1',
          fakeFile('a.pdf', 'application/pdf', 1000),
        ),
      ).rejects.toThrow('Only images and videos');
      expect(uploadBytesResumable).not.toHaveBeenCalled();
    });

    it('rejects files over 25 MB', async () => {
      await expect(
        service.uploadTaskAttachment(
          'board-1',
          'task-1',
          fakeFile('a.png', 'image/png', 26 * 1024 * 1024),
        ),
      ).rejects.toThrow('smaller than 25 MB');
    });

    it('reports progress and resolves with the attachment once the upload completes', async () => {
      const listeners: Record<string, (arg?: unknown) => void> = {};
      const uploadTask = {
        on: vi.fn(
          (
            _event: string,
            onProgress: (s: unknown) => void,
            _onError: unknown,
            onComplete: () => void,
          ) => {
            listeners['progress'] = onProgress;
            listeners['complete'] = onComplete;
          },
        ),
        snapshot: { ref: { path: 'attachment-path' } },
      };
      vi.mocked(uploadBytesResumable).mockReturnValue(uploadTask as never);
      vi.mocked(getDownloadURL).mockResolvedValue('https://example.com/a.png');

      const onProgress = vi.fn();
      const resultPromise = service.uploadTaskAttachment(
        'board-1',
        'task-1',
        fakeFile('a.png', 'image/png', 1000),
        onProgress,
      );

      listeners['progress']({ bytesTransferred: 50, totalBytes: 100 });
      listeners['complete']();

      const attachment = await resultPromise;

      expect(onProgress).toHaveBeenCalledWith(50);
      expect(attachment).toMatchObject({
        fileName: 'a.png',
        fileSize: 1000,
        fileType: 'image/png',
        downloadUrl: 'https://example.com/a.png',
      });
      expect(attachment.storagePath).toContain(
        `boards/board-1/tasks/task-1/attachments/${attachment.id}.png`,
      );
    });
  });

  describe('deleteTaskAttachment', () => {
    it('deletes the object at the given storage path', async () => {
      await service.deleteTaskAttachment('boards/b1/tasks/t1/attachments/a1.png');

      expect(ref).toHaveBeenCalledWith(expect.anything(), 'boards/b1/tasks/t1/attachments/a1.png');
      expect(deleteObject).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteBoardBackground', () => {
    it('tries each known extension until one succeeds', async () => {
      vi.mocked(deleteObject)
        .mockRejectedValueOnce(new Error('not found'))
        .mockRejectedValueOnce(new Error('not found'))
        .mockResolvedValueOnce(undefined as never);

      await service.deleteBoardBackground('board-1');

      expect(deleteObject).toHaveBeenCalledTimes(3);
      expect(ref).toHaveBeenNthCalledWith(3, expect.anything(), 'boards/board-1/background.png');
    });

    it('silently no-ops if no extension matches', async () => {
      vi.mocked(deleteObject).mockRejectedValue(new Error('not found'));

      await expect(service.deleteBoardBackground('board-1')).resolves.toBeUndefined();
      expect(deleteObject).toHaveBeenCalledTimes(4);
    });
  });
});
