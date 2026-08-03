import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({
  storage: {},
}));

const mockUploadBytes = vi.fn();
const mockGetDownloadURL = vi.fn();
const mockDeleteObject = vi.fn();
const mockUploadBytesResumable = vi.fn();

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  uploadBytesResumable: (...args: unknown[]) =>
    mockUploadBytesResumable(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

describe('storageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadBoardBackground', () => {
    it('uploads valid JPEG file', async () => {
      mockUploadBytes.mockResolvedValue(undefined);
      mockGetDownloadURL.mockResolvedValue('https://example.com/bg.jpg');

      const file = new File(['data'], 'background.jpg', {
        type: 'image/jpeg',
      });

      const { uploadBoardBackground } = await import('./storageService');
      const url = await uploadBoardBackground('board-1', file);

      expect(url).toBe('https://example.com/bg.jpg');
      expect(mockUploadBytes).toHaveBeenCalled();
    });

    it('uploads valid PNG file', async () => {
      mockUploadBytes.mockResolvedValue(undefined);
      mockGetDownloadURL.mockResolvedValue('https://example.com/bg.png');

      const file = new File(['data'], 'background.png', {
        type: 'image/png',
      });

      const { uploadBoardBackground } = await import('./storageService');
      const url = await uploadBoardBackground('board-1', file);

      expect(url).toBe('https://example.com/bg.png');
    });

    it('rejects invalid file type', async () => {
      const file = new File(['data'], 'doc.pdf', {
        type: 'application/pdf',
      });

      const { uploadBoardBackground } = await import('./storageService');
      await expect(uploadBoardBackground('board-1', file)).rejects.toThrow(
        'Invalid file type',
      );
    });

    it('rejects file exceeding 5MB', async () => {
      const largeData = new ArrayBuffer(6 * 1024 * 1024);
      const file = new File([largeData], 'big.jpg', {
        type: 'image/jpeg',
      });

      const { uploadBoardBackground } = await import('./storageService');
      await expect(uploadBoardBackground('board-1', file)).rejects.toThrow(
        'File size exceeds 5MB limit',
      );
    });
  });

  describe('deleteBoardBackground', () => {
    it('tries each extension until file found', async () => {
      mockDeleteObject
        .mockRejectedValueOnce(new Error('not found'))
        .mockResolvedValueOnce(undefined);

      const { deleteBoardBackground } = await import('./storageService');
      await deleteBoardBackground('board-1');

      expect(mockDeleteObject).toHaveBeenCalledTimes(2);
    });

    it('does not throw when no file exists', async () => {
      mockDeleteObject.mockRejectedValue(new Error('not found'));

      const { deleteBoardBackground } = await import('./storageService');
      await expect(deleteBoardBackground('board-1')).resolves.toBeUndefined();
    });
  });

  describe('uploadTaskAttachment', () => {
    it('rejects invalid file type', async () => {
      const file = new File(['data'], 'doc.pdf', {
        type: 'application/pdf',
      });

      const { uploadTaskAttachment } = await import('./storageService');
      await expect(
        uploadTaskAttachment('board-1', 'task-1', file),
      ).rejects.toThrow('Invalid file type');
    });

    it('rejects file exceeding 25 MB', async () => {
      const largeData = new ArrayBuffer(26 * 1024 * 1024);
      const file = new File([largeData], 'big.jpg', {
        type: 'image/jpeg',
      });

      const { uploadTaskAttachment } = await import('./storageService');
      await expect(
        uploadTaskAttachment('board-1', 'task-1', file),
      ).rejects.toThrow('File size exceeds 25 MB limit');
    });

    it('uploads valid file and returns attachment metadata', async () => {
      const onCompleteCb: { fn?: () => void } = {};
      mockUploadBytesResumable.mockReturnValue({
        on: (
          _event: string,
          _progress: unknown,
          _error: unknown,
          complete: () => void,
        ) => {
          onCompleteCb.fn = complete;
          // Simulate immediate completion
          setTimeout(() => complete(), 0);
        },
      });
      mockGetDownloadURL.mockResolvedValue('https://example.com/photo.jpg');

      const file = new File(['data'], 'photo.jpg', {
        type: 'image/jpeg',
      });

      const { uploadTaskAttachment } = await import('./storageService');
      const attachment = await uploadTaskAttachment('board-1', 'task-1', file);

      expect(attachment.fileName).toBe('photo.jpg');
      expect(attachment.fileType).toBe('image/jpeg');
      expect(attachment.downloadUrl).toBe('https://example.com/photo.jpg');
      expect(attachment.storagePath).toContain(
        'boards/board-1/tasks/task-1/attachments/',
      );
    });

    it('calls onProgress callback during upload', async () => {
      const onProgress = vi.fn();
      mockUploadBytesResumable.mockReturnValue({
        on: (
          _event: string,
          progressCb: (snapshot: {
            bytesTransferred: number;
            totalBytes: number;
          }) => void,
          _error: unknown,
          complete: () => void,
        ) => {
          progressCb({ bytesTransferred: 50, totalBytes: 100 });
          setTimeout(() => complete(), 0);
        },
      });
      mockGetDownloadURL.mockResolvedValue('https://example.com/photo.jpg');

      const file = new File(['data'], 'photo.jpg', {
        type: 'image/jpeg',
      });

      const { uploadTaskAttachment } = await import('./storageService');
      await uploadTaskAttachment('board-1', 'task-1', file, onProgress);

      expect(onProgress).toHaveBeenCalledWith(50);
    });
  });

  describe('deleteTaskAttachment', () => {
    it('deletes file at given storage path', async () => {
      mockDeleteObject.mockResolvedValue(undefined);

      const { deleteTaskAttachment } = await import('./storageService');
      await deleteTaskAttachment(
        'boards/board-1/tasks/task-1/attachments/abc.jpg',
      );

      expect(mockDeleteObject).toHaveBeenCalled();
    });
  });
});
