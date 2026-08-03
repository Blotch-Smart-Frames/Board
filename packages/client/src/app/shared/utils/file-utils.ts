export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

export const ALLOWED_ATTACHMENT_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
];

export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB

export const MAX_BACKGROUND_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const isImageFile = (mimeType: string): boolean =>
  mimeType.startsWith('image/');

export const isVideoFile = (mimeType: string): boolean =>
  mimeType.startsWith('video/');
