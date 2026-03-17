import { useRef } from 'react';
import { Button } from '@mui/material';
import { AttachFile as AttachFileIcon } from '@mui/icons-material';
import { ALLOWED_ATTACHMENT_TYPES } from '../../utils/fileUtils';

type AttachmentUploadButtonProps = {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
};

export const AttachmentUploadButton = ({
  onFilesSelected,
  disabled = false,
}: AttachmentUploadButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) {
      onFilesSelected(Array.from(files));
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_ATTACHMENT_TYPES.join(',')}
        multiple
        onChange={handleChange}
        hidden
      />
      <Button
        startIcon={<AttachFileIcon />}
        onClick={handleClick}
        disabled={disabled}
        size="small"
        type="button"
      >
        Add Attachment
      </Button>
    </>
  );
};
