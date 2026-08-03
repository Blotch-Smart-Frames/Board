import { describe, it, expect } from 'vitest';
import { formatFileSize, isImageFile, isVideoFile } from './fileUtils';

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe('2.4 MB');
  });

  it('formats zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });
});

describe('isImageFile', () => {
  it('returns true for image MIME types', () => {
    expect(isImageFile('image/jpeg')).toBe(true);
    expect(isImageFile('image/png')).toBe(true);
    expect(isImageFile('image/webp')).toBe(true);
  });

  it('returns false for non-image MIME types', () => {
    expect(isImageFile('video/mp4')).toBe(false);
    expect(isImageFile('application/pdf')).toBe(false);
  });
});

describe('isVideoFile', () => {
  it('returns true for video MIME types', () => {
    expect(isVideoFile('video/mp4')).toBe(true);
    expect(isVideoFile('video/quicktime')).toBe(true);
    expect(isVideoFile('video/webm')).toBe(true);
  });

  it('returns false for non-video MIME types', () => {
    expect(isVideoFile('image/png')).toBe(false);
    expect(isVideoFile('application/pdf')).toBe(false);
  });
});
