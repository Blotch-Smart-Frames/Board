import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { LabelChip } from '../common/LabelChip';
import { TaskAssignees } from './TaskAssignees';
import { AttachmentSection } from '../attachments/AttachmentSection';
import { CommentsSection } from './CommentsSection';
import { HistorySection } from './HistorySection';
import type { Task, Label, List, Attachment } from '../../types/board';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';

type TaskDetailDialogProps = {
  open: boolean;
  boardId: string;
  task: Task | null;
  labels?: Label[];
  lists?: List[];
  collaborators?: Collaborator[];
  onClose: () => void;
  onEdit: () => void;
  onAttachmentsChange: (attachments: Attachment[]) => void;
  onMoveTask?: (newListId: string) => void;
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
  lists = [],
  collaborators = [],
  onClose,
  onEdit,
  onAttachmentsChange,
  onMoveTask,
}: TaskDetailDialogProps) => {
  const [tabIndex, setTabIndex] = useState(0);

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

      <Tabs
        value={tabIndex}
        onChange={(_, v) => setTabIndex(v)}
        sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Details" />
        <Tab label="History" />
      </Tabs>

      <DialogContent dividers={false} sx={{ pt: 2 }}>
        {tabIndex === 0 && (
          <Box className="flex flex-col gap-3">
            {lists.length > 0 && onMoveTask && (
              <FormControl size="small" fullWidth>
                <InputLabel id="move-to-list-label">List</InputLabel>
                <Select
                  labelId="move-to-list-label"
                  label="List"
                  value={task.listId}
                  onChange={(e) => onMoveTask(e.target.value)}
                >
                  {lists.map((list) => (
                    <MenuItem key={list.id} value={list.id}>
                      {list.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

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

            <AttachmentSection
              boardId={boardId}
              taskId={task.id}
              attachments={task.attachments ?? []}
              onChange={onAttachmentsChange}
            />

            <Divider />

            <CommentsSection
              boardId={boardId}
              taskId={task.id}
              collaborators={collaborators}
            />
          </Box>
        )}

        {tabIndex === 1 && (
          <HistorySection
            boardId={boardId}
            taskId={task.id}
            collaborators={collaborators}
          />
        )}
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
