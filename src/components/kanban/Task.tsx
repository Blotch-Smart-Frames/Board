import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Card,
  CardContent,
  Typography,
  IconButton,
  Box,
  Chip,
  Tooltip,
  Checkbox,
} from '@mui/material';
import {
  CalendarMonth as CalendarIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { LabelChip } from '../common/LabelChip';
import { TaskAssignees } from './TaskAssignees';
import type {
  Task as TaskType,
  UpdateTaskInput,
  Label,
} from '../../types/board';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';

type TaskProps = {
  task: TaskType;
  labels?: Label[];
  collaborators?: Collaborator[];
  onEdit?: (task: TaskType) => void;
  onUpdate?: (taskId: string, updates: UpdateTaskInput) => void;
  isDragging?: boolean;
};

export function Task({
  task,
  labels = [],
  collaborators = [],
  onEdit,
  onUpdate,
  isDragging = false,
}: TaskProps) {
  const assignedUsers = collaborators.filter((c) =>
    task.assignedTo?.includes(c.id)
  );
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const formatDueDate = (timestamp: TaskType['dueDate']) => {
    if (!timestamp) return null;
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (!onUpdate) return;
    const newCompletedAt = event.target.checked ? new Date() : null;
    onUpdate(task.id, { completedAt: newCompletedAt });
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`mb-2 cursor-grab active:cursor-grabbing ${
        isDragging || isSortableDragging
          ? 'shadow-lg ring-2 ring-primary-500'
          : ''
      }`}
      sx={{
        backgroundColor: task.color
          ? `${task.color}15`
          : 'background.paper',
        '&:hover': {
          boxShadow: 3,
        },
      }}
    >
      <CardContent className="p-3!">
        <Box className="flex items-start gap-2">
          <Checkbox
            checked={!!task.completedAt}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
            size="small"
            sx={{ padding: '2px' }}
          />

          <Box className="flex-1 min-w-0">
            <Typography
              variant="body2"
              component="h3"
              className="font-medium"
              color="text.primary"
              sx={{
                wordBreak: 'break-word',
                textDecoration: task.completedAt ? 'line-through' : 'none',
                opacity: task.completedAt ? 0.6 : 1,
              }}
            >
              {task.title}
            </Typography>

            {task.description && (
              <Typography
                variant="caption"
                color="text.secondary"
                className="line-clamp-2 mt-1"
              >
                {task.description}
              </Typography>
            )}

            {task.labelIds && task.labelIds.length > 0 && labels.length > 0 && (
              <Box className="flex flex-wrap gap-1 mt-2">
                {task.labelIds
                  .map((labelId) => labels.find((l) => l.id === labelId))
                  .filter((label): label is Label => !!label)
                  .map((label) => (
                    <LabelChip key={label.id} label={label} size="small" />
                  ))}
              </Box>
            )}

            <Box className="flex items-center gap-2 mt-2 flex-wrap">
              {task.dueDate && (
                <Chip
                  size="small"
                  icon={<CalendarIcon fontSize="small" />}
                  label={formatDueDate(task.dueDate)}
                  variant="outlined"
                  color={task.calendarSyncEnabled ? 'primary' : 'default'}
                  className="h-6!"
                />
              )}

              <TaskAssignees assignedUsers={assignedUsers} />

              {task.calendarSyncEnabled && (
                <Tooltip title="Synced with Google Calendar">
                  <CalendarIcon
                    fontSize="small"
                    color="primary"
                    className="!w-4 !h-4"
                  />
                </Tooltip>
              )}
            </Box>
          </Box>

          {onEdit && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              className="shrink-0 opacity-0 group-hover:opacity-100"
              sx={{
                opacity: 0,
                '.MuiCard-root:hover &': {
                  opacity: 1,
                },
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
