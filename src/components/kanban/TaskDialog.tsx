import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControlLabel,
  Switch,
  IconButton,
  Typography,
  Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Close as CloseIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useForm } from '@tanstack/react-form';
import { LabelPicker } from './LabelPicker';
import { AssigneePicker } from './AssigneePicker';
import { ColorPicker } from '../common/ColorPicker';
import { SprintPicker } from '../sprints';
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  Board,
} from '../../types/board';
import type { Collaborator } from '../../hooks/useCollaboratorsQuery';

type TaskDialogProps = {
  open: boolean;
  boardId: string;
  board?: Board | null;
  task?: Task | null;
  collaborators?: Collaborator[];
  onClose: () => void;
  onSave: (data: CreateTaskInput | UpdateTaskInput) => void;
  onDelete?: () => void;
};

export function TaskDialog({
  open,
  boardId,
  board,
  task,
  collaborators,
  onClose,
  onSave,
  onDelete,
}: TaskDialogProps) {
  const isEditing = !!task;

  const form = useForm({
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      startDate: (task?.startDate?.toDate() ?? null) as Date | null,
      dueDate: (task?.dueDate?.toDate() ?? null) as Date | null,
      calendarSyncEnabled: task?.calendarSyncEnabled ?? false,
      labelIds: task?.labelIds ?? [],
      assignedTo: task?.assignedTo ?? [],
      color: task?.color ?? '',
      sprintId: (task?.sprintId ?? null) as string | null,
    },
    onSubmit: async ({ value }) => {
      const data: CreateTaskInput | UpdateTaskInput = {
        title: value.title.trim(),
        description: value.description.trim() || undefined,
        startDate: value.startDate || undefined,
        dueDate: value.dueDate || undefined,
        calendarSyncEnabled: value.calendarSyncEnabled,
        labelIds: value.labelIds,
        assignedTo: value.assignedTo,
        color: value.color || (isEditing ? null : undefined),
        sprintId: value.sprintId || (isEditing ? null : undefined),
      };
      onSave(data);
      onClose();
    },
  });

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <DialogTitle className="flex items-center justify-between">
            <Typography component="span" variant="h6">
              {isEditing ? 'Edit Task' : 'Create Task'}
            </Typography>
            <IconButton onClick={onClose} size="small" type="button">
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers>
            <Box className="flex flex-col gap-4">
              <form.Field
                name="title"
                validators={{
                  onChange: ({ value }) =>
                    !value.trim() ? 'Title is required' : undefined,
                }}
              >
                {(field) => (
                  <TextField
                    label="Title"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    error={
                      field.state.meta.isTouched && !field.state.meta.isValid
                    }
                    helperText={
                      field.state.meta.isTouched &&
                      field.state.meta.errors.join(', ')
                    }
                    fullWidth
                    required
                    autoFocus
                  />
                )}
              </form.Field>

              <form.Field name="description">
                {(field) => (
                  <TextField
                    label="Description"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    fullWidth
                    multiline
                    rows={3}
                  />
                )}
              </form.Field>

              <Divider />

              <form.Field name="labelIds">
                {(field) => (
                  <LabelPicker
                    boardId={boardId}
                    selectedLabelIds={field.state.value}
                    onChange={field.handleChange}
                  />
                )}
              </form.Field>

              <Divider />

              <form.Field name="assignedTo">
                {(field) => (
                  <AssigneePicker
                    collaborators={collaborators ?? []}
                    selectedUserIds={field.state.value}
                    onChange={field.handleChange}
                  />
                )}
              </form.Field>

              <Divider />

              <form.Field name="sprintId">
                {(field) => (
                  <SprintPicker
                    boardId={boardId}
                    board={board}
                    selectedSprintId={field.state.value}
                    onChange={field.handleChange}
                  />
                )}
              </form.Field>

              <Divider />

              <Box>
                <Box className="mb-2 flex items-center justify-between">
                  <Typography variant="subtitle2" color="text.secondary">
                    Card Color
                  </Typography>
                  <form.Field name="color">
                    {(field) =>
                      field.state.value && (
                        <Button
                          size="small"
                          onClick={() => field.handleChange('')}
                          type="button"
                        >
                          Clear
                        </Button>
                      )
                    }
                  </form.Field>
                </Box>
                <form.Field name="color">
                  {(field) => (
                    <ColorPicker
                      value={field.state.value}
                      onChange={field.handleChange}
                    />
                  )}
                </form.Field>
              </Box>

              <Divider />

              <div className="flex gap-4">
                <form.Subscribe selector={(state) => state.values.dueDate}>
                  {(dueDate) => (
                    <form.Field
                      name="startDate"
                      validators={{
                        onChange: ({ value }) =>
                          value && dueDate && value > dueDate
                            ? 'Start date must be before or equal to due date'
                            : undefined,
                      }}
                    >
                      {(field) => (
                        <DatePicker
                          label="Start date"
                          value={field.state.value}
                          onChange={(date) => field.handleChange(date)}
                          maxDate={dueDate || undefined}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              error:
                                field.state.meta.isTouched &&
                                !field.state.meta.isValid,
                              helperText:
                                field.state.meta.isTouched &&
                                field.state.meta.errors.join(', '),
                            },
                          }}
                        />
                      )}
                    </form.Field>
                  )}
                </form.Subscribe>

                <form.Subscribe selector={(state) => state.values.startDate}>
                  {(startDate) => (
                    <form.Field
                      name="dueDate"
                      validators={{
                        onChange: ({ value }) =>
                          value && startDate && value < startDate
                            ? 'Due date must be after or equal to start date'
                            : undefined,
                      }}
                    >
                      {(field) => (
                        <DatePicker
                          label="Due date"
                          value={field.state.value}
                          onChange={(date) => field.handleChange(date)}
                          minDate={startDate || undefined}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              error:
                                field.state.meta.isTouched &&
                                !field.state.meta.isValid,
                              helperText:
                                field.state.meta.isTouched &&
                                field.state.meta.errors.join(', '),
                            },
                          }}
                        />
                      )}
                    </form.Field>
                  )}
                </form.Subscribe>
              </div>

              <form.Subscribe selector={(state) => state.values.dueDate}>
                {(dueDate) => (
                  <form.Field name="calendarSyncEnabled">
                    {(field) => (
                      <>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.checked)
                              }
                              disabled={!dueDate}
                            />
                          }
                          label="Sync with Google Calendar"
                        />
                        {!dueDate && field.state.value && (
                          <Typography variant="caption" color="text.secondary">
                            Set a due date to enable calendar sync
                          </Typography>
                        )}
                      </>
                    )}
                  </form.Field>
                )}
              </form.Subscribe>
            </Box>
          </DialogContent>

          <DialogActions className="flex w-full justify-between!">
            <Box>
              {isEditing && onDelete && (
                <Button
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDelete}
                  type="button"
                >
                  Delete
                </Button>
              )}
            </Box>
            <Box className="flex gap-2">
              <Button onClick={onClose} type="button">
                Cancel
              </Button>
              <form.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                  title: state.values.title,
                })}
              >
                {({ canSubmit, isSubmitting, title }) => (
                  <Button
                    variant="contained"
                    type="submit"
                    disabled={!title.trim() || !canSubmit || isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : isEditing ? 'Save' : 'Create'}
                  </Button>
                )}
              </form.Subscribe>
            </Box>
          </DialogActions>
        </form>
      </Dialog>
    </LocalizationProvider>
  );
}
