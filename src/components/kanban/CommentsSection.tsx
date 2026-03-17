import { Box, Typography } from '@mui/material';
import { CommentInput } from './CommentInput';
import { CommentItem } from './CommentItem';
import { useCommentsQuery } from '../../hooks/useCommentsQuery';
import { useAuthQuery } from '../../hooks/useAuthQuery';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';

type CommentsSectionProps = {
  boardId: string;
  taskId: string;
  collaborators: Collaborator[];
};

export const CommentsSection = ({
  boardId,
  taskId,
  collaborators,
}: CommentsSectionProps) => {
  const { comments, addComment, updateComment, deleteComment } =
    useCommentsQuery(boardId, taskId);
  const { user } = useAuthQuery();

  const handleSubmit = async (text: string) => {
    await addComment({ text });
  };

  const handleUpdate = async (commentId: string, text: string) => {
    await updateComment(commentId, { text });
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId);
  };

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Comments
      </Typography>
      {comments.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ mb: 1 }}>
          No comments yet
        </Typography>
      ) : (
        <Box sx={{ mb: 1 }}>
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              author={collaborators.find((c) => c.id === comment.authorId)}
              isOwnComment={user?.uid === comment.authorId}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </Box>
      )}
      <CommentInput onSubmit={handleSubmit} />
    </Box>
  );
};
