import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({
  storage: {},
}));

const mockUploadBytes = vi.fn();
const mockGetDownloadURL = vi.fn();
const mockDeleteObject = vi.fn();

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
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
      await expect(
        uploadBoardBackground('board-1', file),
      ).rejects.toThrow('Invalid file type');
    });

    it('rejects file exceeding 5MB', async () => {
      const largeData = new ArrayBuffer(6 * 1024 * 1024);
      const file = new File([largeData], 'big.jpg', {
        type: 'image/jpeg',
      });

      const { uploadBoardBackground } = await import('./storageService');
      await expect(
        uploadBoardBackground('board-1', file),
      ).rejects.toThrow('File size exceeds 5MB limit');
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
      await expect(
        deleteBoardBackground('board-1'),
      ).resolves.toBeUndefined();
    });
  });
});
