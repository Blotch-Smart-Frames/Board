import {
  ALLOWED_ATTACHMENT_TYPES,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_ATTACHMENT_SIZE,
  MAX_BACKGROUND_IMAGE_SIZE,
  formatFileSize,
  isImageFile,
  isVideoFile,
} from './file-utils';

describe('allowed types', () => {
  it('exposes JPEG, PNG and WebP as allowed image types', () => {
    expect(ALLOWED_IMAGE_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });

  it('exposes MP4, QuickTime and WebM as allowed video types', () => {
    expect(ALLOWED_VIDEO_TYPES).toEqual(['video/mp4', 'video/quicktime', 'video/webm']);
  });

  it('combines image and video types in ALLOWED_ATTACHMENT_TYPES', () => {
    expect(ALLOWED_ATTACHMENT_TYPES).toEqual([...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]);
  });
});

describe('size limits', () => {
  it('caps attachments at 25 MB', () => {
    expect(MAX_ATTACHMENT_SIZE).toBe(25 * 1024 * 1024);
  });

  it('caps background images at 5 MB', () => {
    expect(MAX_BACKGROUND_IMAGE_SIZE).toBe(5 * 1024 * 1024);
  });
});

describe('formatFileSize', () => {
  it('renders bytes when below 1 KB', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('renders KB with one decimal when below 1 MB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(1024 * 1024 - 1)).toBe('1024.0 KB');
  });

  it('renders MB with one decimal for anything at or above 1 MB', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});

describe('isImageFile', () => {
  it('returns true for any image/* MIME type', () => {
    expect(isImageFile('image/png')).toBe(true);
    expect(isImageFile('image/jpeg')).toBe(true);
    expect(isImageFile('image/svg+xml')).toBe(true);
  });

  it('returns false for non-image MIME types', () => {
    expect(isImageFile('video/mp4')).toBe(false);
    expect(isImageFile('application/pdf')).toBe(false);
    expect(isImageFile('')).toBe(false);
  });
});

describe('isVideoFile', () => {
  it('returns true for any video/* MIME type', () => {
    expect(isVideoFile('video/mp4')).toBe(true);
    expect(isVideoFile('video/webm')).toBe(true);
  });

  it('returns false for non-video MIME types', () => {
    expect(isVideoFile('image/png')).toBe(false);
    expect(isVideoFile('audio/mp3')).toBe(false);
  });
});
