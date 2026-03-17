import { Box, Typography, CircularProgress } from '@mui/material';
import { useHistoryQuery } from '../../hooks/useHistoryQuery';
import type { HistoryEntry } from '../../types/board';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';

type HistorySectionProps = {
  boardId: string;
  taskId: string;
  collaborators: Collaborator[];
};

const formatRelativeTime = (timestamp: HistoryEntry['createdAt']) => {
  if (!timestamp?.toDate) return '';
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const getEntryDescription = (
  entry: HistoryEntry,
  collaborators: Collaborator[],
): string => {
  const user =
    collaborators.find((c) => c.id === entry.userId)?.name ?? 'Someone';
  const meta = entry.metadata;

  switch (entry.action) {
    case 'label_added':
      return `${user} added label ${meta?.labelName ?? ''}`;
    case 'label_removed':
      return `${user} removed label ${meta?.labelName ?? ''}`;
    case 'assignee_added':
      return `${user} assigned ${meta?.userName ?? ''}`;
    case 'assignee_removed':
      return `${user} unassigned ${meta?.userName ?? ''}`;
    case 'attachment_added':
      return `${user} added attachment ${meta?.fileName ?? ''}`;
    case 'attachment_removed':
      return `${user} removed attachment ${meta?.fileName ?? ''}`;
    case 'moved':
      return `${user} moved from ${meta?.fromListName ?? ''} to ${meta?.toListName ?? ''}`;
    case 'completed':
      return `${user} marked as complete`;
    case 'reopened':
      return `${user} reopened`;
    case 'field_changed':
      return `${user} changed ${entry.field ?? 'a field'}`;
    default:
      return `${user} made a change`;
  }
};

export const HistorySection = ({
  boardId,
  taskId,
  collaborators,
}: HistorySectionProps) => {
  const { history, isLoading } = useHistoryQuery(boardId, taskId);

  if (isLoading) {
    return (
      <Box className="flex justify-center p-4">
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (history.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        No activity yet
      </Typography>
    );
  }

  return (
    <Box className="flex flex-col gap-2">
      {history.map((entry) => (
        <Box key={entry.id} className="flex items-start gap-2">
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: 'text.disabled',
              mt: 0.8,
              flexShrink: 0,
            }}
          />
          <Box className="min-w-0 flex-1">
            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
              {getEntryDescription(entry, collaborators)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatRelativeTime(entry.createdAt)}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
