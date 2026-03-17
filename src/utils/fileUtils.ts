export const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const isImageFile = (mimeType: string): boolean =>
  mimeType.startsWith('image/');

export const isVideoFile = (mimeType: string): boolean =>
  mimeType.startsWith('video/');
