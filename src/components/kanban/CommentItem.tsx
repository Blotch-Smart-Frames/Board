import { useState } from 'react';
import { Box, IconButton, TextField, Typography, Button } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import type { Comment } from '../../types/board';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';

type CommentItemProps = {
  comment: Comment;
  author: Collaborator | undefined;
  isOwnComment: boolean;
  onUpdate: (commentId: string, text: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
};

const formatCommentDate = (timestamp: Comment['createdAt']) => {
  if (!timestamp?.toDate) return '';
  return timestamp.toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const CommentItem = ({
  comment,
  author,
  isOwnComment,
  onUpdate,
  onDelete,
}: CommentItemProps) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onUpdate(comment.id, trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditText(comment.text);
    setEditing(false);
  };

  return (
    <Box sx={{ py: 1 }}>
      <Box className="flex items-center justify-between">
        <Box className="flex items-center gap-1">
          <Typography variant="subtitle2">
            {author?.name ?? 'Unknown User'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatCommentDate(comment.createdAt)}
          </Typography>
        </Box>
        {isOwnComment && !editing && (
          <Box>
            <IconButton
              size="small"
              aria-label="edit comment"
              onClick={() => setEditing(true)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label="delete comment"
              onClick={() => onDelete(comment.id)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>
      {editing ? (
        <Box className="flex flex-col gap-1" sx={{ mt: 0.5 }}>
          <TextField
            size="small"
            fullWidth
            multiline
            rows={2}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            disabled={saving}
          />
          <Box className="flex justify-end gap-1">
            <Button size="small" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleSave}
              disabled={!editText.trim() || saving}
            >
              Save
            </Button>
          </Box>
        </Box>
      ) : (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
          {comment.text}
        </Typography>
      )}
    </Box>
  );
};
