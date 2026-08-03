import { useState } from 'react';
import { Box, Button } from '@mui/material';
import MDEditor from '@uiw/react-md-editor';
import { useColorMode } from '../../hooks/useColorMode';

type CommentInputProps = {
  onSubmit: (text: string) => Promise<void>;
};

export const CommentInput = ({ onSubmit }: CommentInputProps) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const colorMode = useColorMode();

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setText('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box className="flex flex-col gap-1" data-color-mode={colorMode}>
      <MDEditor
        value={text}
        onChange={(val) => setText(val || '')}
        height={120}
        preview="edit"
        textareaProps={{ placeholder: 'Add a comment...' }}
        previewOptions={{ disallowedElements: ['style', 'script'] }}
      />
      <Box className="flex justify-end">
        <Button
          size="small"
          variant="contained"
          disabled={!text.trim() || submitting}
          onClick={handleSubmit}
        >
          Post
        </Button>
      </Box>
    </Box>
  );
};
