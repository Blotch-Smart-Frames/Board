import { useState } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { AttachmentUploadButton } from './AttachmentUploadButton';
import { AttachmentList, type UploadInProgress } from './AttachmentList';
import {
  uploadTaskAttachment,
  deleteTaskAttachment,
} from '../../services/storageService';
import type { Attachment } from '../../types/board';

type AttachmentSectionProps = {
  boardId: string;
  taskId: string;
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
};

export const AttachmentSection = ({
  boardId,
  taskId,
  attachments,
  onChange,
}: AttachmentSectionProps) => {
  const [uploads, setUploads] = useState<UploadInProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = (files: File[]) => {
    setError(null);
    files.forEach((file) => {
      const uploadId = crypto.randomUUID();
      setUploads((prev) => [
        ...prev,
        { id: uploadId, fileName: file.name, progress: 0 },
      ]);

      uploadTaskAttachment(boardId, taskId, file, (progress) => {
        setUploads((prev) =>
          prev.map((u) => (u.id === uploadId ? { ...u, progress } : u)),
        );
      })
        .then((attachment) => {
          setUploads((prev) => prev.filter((u) => u.id !== uploadId));
          onChange([...attachments, attachment]);
        })
        .catch((err: Error) => {
          setUploads((prev) => prev.filter((u) => u.id !== uploadId));
          setError(err.message);
        });
    });
  };

  const handleDelete = (attachmentId: string) => {
    const attachment = attachments.find((a) => a.id === attachmentId);
    if (!attachment) return;

    deleteTaskAttachment(attachment.storagePath).catch(() => {});
    onChange(attachments.filter((a) => a.id !== attachmentId));
  };

  return (
    <Box>
      <Box className="mb-2 flex items-center justify-between">
        <Typography variant="subtitle2" color="text.secondary">
          Attachments
        </Typography>
        <AttachmentUploadButton
          onFilesSelected={handleFilesSelected}
          disabled={uploads.length > 0}
        />
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}

      {(attachments.length > 0 || uploads.length > 0) && (
        <AttachmentList
          attachments={attachments}
          uploads={uploads}
          onDelete={handleDelete}
        />
      )}
    </Box>
  );
};
