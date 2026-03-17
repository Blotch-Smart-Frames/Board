import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Chip,
  Divider,
  IconButton,
  Typography,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { LabelChip } from '../common/LabelChip';
import { TaskAssignees } from './TaskAssignees';
import { AttachmentPreview } from '../attachments/AttachmentPreview';
import { CommentsSection } from './CommentsSection';
import type { Task, Label } from '../../types/board';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';

type TaskDetailDialogProps = {
  open: boolean;
  boardId: string;
  task: Task | null;
  labels?: Label[];
  collaborators?: Collaborator[];
  onClose: () => void;
  onEdit: () => void;
};

const formatDate = (timestamp: Task['dueDate']) => {
  if (!timestamp) return null;
  return timestamp.toDate().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const TaskDetailDialog = ({
  open,
  boardId,
  task,
  labels = [],
  collaborators = [],
  onClose,
  onEdit,
}: TaskDetailDialogProps) => {
  if (!task) return null;

  const assignedUsers = collaborators.filter((c) =>
    task.assignedTo?.includes(c.id),
  );

  const taskLabels = (task.labelIds ?? [])
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is Label => !!l);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className="flex items-center justify-between">
        <Typography
          component="span"
          variant="h6"
          sx={{ wordBreak: 'break-word', pr: 1 }}
        >
          {task.title}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box className="flex flex-col gap-3">
          {task.description && (
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Description
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {task.description}
              </Typography>
            </Box>
          )}

          {taskLabels.length > 0 && (
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Labels
              </Typography>
              <Box className="flex flex-wrap gap-1">
                {taskLabels.map((label) => (
                  <LabelChip key={label.id} label={label} />
                ))}
              </Box>
            </Box>
          )}

          {assignedUsers.length > 0 && (
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Assignees
              </Typography>
              <TaskAssignees assignedUsers={assignedUsers} />
            </Box>
          )}

          {(task.startDate || task.dueDate) && (
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Dates
              </Typography>
              <Box className="flex flex-wrap gap-2">
                {task.startDate && (
                  <Chip
                    size="small"
                    icon={<CalendarIcon fontSize="small" />}
                    label={`Start: ${formatDate(task.startDate)}`}
                    variant="outlined"
                  />
                )}
                {task.dueDate && (
                  <Chip
                    size="small"
                    icon={<CalendarIcon fontSize="small" />}
                    label={`Due: ${formatDate(task.dueDate)}`}
                    variant="outlined"
                    color={task.calendarSyncEnabled ? 'primary' : 'default'}
                  />
                )}
              </Box>
            </Box>
          )}

          {task.attachments && task.attachments.length > 0 && (
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
              >
                Attachments
              </Typography>
              <Box className="flex flex-col gap-1">
                {task.attachments.map((attachment) => (
                  <AttachmentPreview
                    key={attachment.id}
                    attachment={attachment}
                  />
                ))}
              </Box>
            </Box>
          )}

          <Divider />

          <CommentsSection
            boardId={boardId}
            taskId={task.id}
            collaborators={collaborators}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={onEdit}>
          Edit
        </Button>
      </DialogActions>
    </Dialog>
  );
};
