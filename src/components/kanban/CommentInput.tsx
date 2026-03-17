import { useState } from 'react';
import { Box, Button, TextField } from '@mui/material';

type CommentInputProps = {
  onSubmit: (text: string) => Promise<void>;
};

export const CommentInput = ({ onSubmit }: CommentInputProps) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <Box className="flex flex-col gap-1">
      <TextField
        placeholder="Add a comment..."
        size="small"
        fullWidth
        multiline
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={submitting}
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
