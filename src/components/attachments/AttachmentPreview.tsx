import { Box, IconButton, Typography, Link } from '@mui/material';
import {
  Delete as DeleteIcon,
  Videocam as VideocamIcon,
} from '@mui/icons-material';
import type { Attachment } from '../../types/board';
import { formatFileSize, isImageFile } from '../../utils/fileUtils';

type AttachmentPreviewProps = {
  attachment: Attachment;
  onDelete?: (id: string) => void;
};

export const AttachmentPreview = ({
  attachment,
  onDelete,
}: AttachmentPreviewProps) => (
  <Box className="flex items-center gap-2 rounded border p-2">
    <Box className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded">
      {isImageFile(attachment.fileType) ? (
        <img
          src={attachment.downloadUrl}
          alt={attachment.fileName}
          className="h-full w-full object-cover"
        />
      ) : (
        <VideocamIcon color="action" />
      )}
    </Box>

    <Box className="min-w-0 flex-1">
      <Link
        href={attachment.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        underline="hover"
        variant="body2"
        className="block truncate"
      >
        {attachment.fileName}
      </Link>
      <Typography variant="caption" color="text.secondary">
        {formatFileSize(attachment.fileSize)}
      </Typography>
    </Box>

    {onDelete && (
      <IconButton
        size="small"
        onClick={() => onDelete(attachment.id)}
        aria-label="Delete attachment"
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    )}
  </Box>
);
