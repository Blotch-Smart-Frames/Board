import { Box, LinearProgress, Typography } from '@mui/material';
import { AttachmentPreview } from './AttachmentPreview';
import type { Attachment } from '../../types/board';

export type UploadInProgress = {
  id: string;
  fileName: string;
  progress: number;
};

type AttachmentListProps = {
  attachments: Attachment[];
  uploads: UploadInProgress[];
  onDelete: (id: string) => void;
};

export const AttachmentList = ({
  attachments,
  uploads,
  onDelete,
}: AttachmentListProps) => (
  <Box className="flex flex-col gap-2">
    {uploads.map((upload) => (
      <Box key={upload.id} className="rounded border p-2">
        <Typography variant="body2" className="truncate">
          {upload.fileName}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={upload.progress}
          sx={{ mt: 0.5 }}
        />
      </Box>
    ))}

    {attachments.map((attachment) => (
      <AttachmentPreview
        key={attachment.id}
        attachment={attachment}
        onDelete={onDelete}
      />
    ))}
  </Box>
);
